import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { validateBackupData } from "@/lib/import-export"
import { serviceBranches, services, settings, tasks } from "@/lib/schema"
import { requireBranchService } from "@/lib/service-branch-utils"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const importData = validateBackupData(body)

    await db.transaction(async (tx) => {
      let availableServices = (await tx.select().from(services)).map((service) => ({
        id: service.id,
        name: service.name,
      }))

      if (importData.services !== undefined) {
        await tx.delete(services)

        if (importData.services.length > 0) {
          await tx.insert(services).values(
            importData.services.map((service) => ({
              id: service.id || crypto.randomUUID(),
              name: service.name.trim(),
              description: service.description ?? "",
              repository: service.repository ?? "",
              testBranch: service.testBranch ?? "develop",
              masterBranch: service.masterBranch ?? "main",
              dependencies: JSON.stringify(service.dependencies ?? []),
            }))
          )
        }

        availableServices = (await tx.select().from(services)).map((service) => ({
          id: service.id,
          name: service.name,
        }))
      }

      if (importData.tasks !== undefined) {
        await tx.delete(tasks)

        if (importData.tasks.length > 0) {
          const now = new Date().toISOString()
          const normalizedTasks = importData.tasks.map((task) => ({
            ...task,
            id: task.id || crypto.randomUUID(),
            createdAt: task.createdAt ?? now,
            updatedAt: task.updatedAt ?? now,
          }))

          await tx.insert(tasks).values(
            normalizedTasks.map((task) => ({
              id: task.id,
              title: task.title.trim(),
              description: task.description ?? "",
              status: task.status ?? "backlog",
              priority: task.priority ?? "medium",
              assigneeName: task.assignee?.name ?? null,
              assigneeAvatar: task.assignee?.avatar ?? null,
              jiraUrl: task.jiraUrl ?? null,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
            }))
          )

          const importedBranches = normalizedTasks.flatMap((task) =>
            (task.serviceBranches ?? []).map((branch) => {
              const normalizedService = requireBranchService(availableServices, branch)

              return {
                id: branch.id || crypto.randomUUID(),
                taskId: task.id,
                serviceId: normalizedService.serviceId,
                serviceName: normalizedService.serviceName,
                branchName: branch.branchName,
                pullRequestUrl: branch.pullRequestUrl ?? null,
                mergedToTest: branch.mergedToTest ? 1 : 0,
                mergedToMaster: branch.mergedToMaster ? 1 : 0,
                testMergeDate: branch.testMergeDate ?? null,
                masterMergeDate: branch.masterMergeDate ?? null,
                lastCommit: branch.lastCommit ?? null,
                lastStatusCheck: branch.lastStatusCheck ?? null,
                prStatus: branch.prStatus ? JSON.stringify(branch.prStatus) : null,
                diffStatus: branch.diffStatus ? JSON.stringify(branch.diffStatus) : null,
                createdAt: branch.createdAt ?? task.createdAt ?? now,
              }
            })
          )

          if (importedBranches.length > 0) {
            await tx.insert(serviceBranches).values(importedBranches)
          }
        }
      }

      if (importData.settings !== undefined) {
        const updateData: Partial<typeof settings.$inferInsert> = {}
        const source = importData.settings

        if (source.notifications !== undefined) updateData.notifications = source.notifications ? 1 : 0
        if (source.autoSave !== undefined) updateData.autoSave = source.autoSave ? 1 : 0
        if (source.darkMode !== undefined) updateData.darkMode = source.darkMode ? 1 : 0
        if (source.compactView !== undefined) updateData.compactView = source.compactView ? 1 : 0
        if (source.showAssigneeAvatars !== undefined) updateData.showAssigneeAvatars = source.showAssigneeAvatars ? 1 : 0
        if (source.defaultPriority !== undefined) updateData.defaultPriority = source.defaultPriority
        if (source.autoCreateBranch !== undefined) updateData.autoCreateBranch = source.autoCreateBranch ? 1 : 0
        if (source.branchPrefix !== undefined) updateData.branchPrefix = source.branchPrefix

        await tx.update(settings).set(updateData).where(eq(settings.id, "singleton"))
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST /api/import error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导入失败" },
      { status: 400 }
    )
  }
}
