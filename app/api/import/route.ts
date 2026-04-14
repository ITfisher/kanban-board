import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { validateBackupData } from "@/lib/import-export"
import { serviceBranches, services, settings, tasks } from "@/lib/schema"
import { requireBranchService } from "@/lib/service-branch-utils"
import { isCompletedTaskStatus, normalizeTaskStatus } from "@/lib/task-status"

function getCompletedAtForStatus(status: string, previousCompletedAt?: string | null) {
  if (isCompletedTaskStatus(normalizeTaskStatus(status))) {
    return previousCompletedAt ?? new Date().toISOString()
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const importData = validateBackupData(body)

    db.transaction((tx) => {
      let availableServices = tx.select().from(services).all().map((service) => ({
        id: service.id,
        name: service.name,
      }))

      if (importData.services !== undefined) {
        tx.delete(services).run()

        if (importData.services.length > 0) {
          tx.insert(services).values(
            importData.services.map((service) => ({
              id: service.id || crypto.randomUUID(),
              name: service.name.trim(),
              description: service.description ?? "",
              repository: service.repository ?? "",
              testBranch: service.testBranch ?? "develop",
              masterBranch: service.masterBranch ?? "main",
              dependencies: JSON.stringify(service.dependencies ?? []),
            }))
          ).run()
        }

        availableServices = tx.select().from(services).all().map((service) => ({
          id: service.id,
          name: service.name,
        }))
      }

      if (importData.tasks !== undefined) {
        tx.delete(serviceBranches).run()
        tx.delete(tasks).run()

        if (importData.tasks.length > 0) {
          const now = new Date().toISOString()
          const normalizedTasks = importData.tasks.map((task) => ({
            ...task,
            id: task.id || crypto.randomUUID(),
            createdAt: task.createdAt ?? now,
            updatedAt: task.updatedAt ?? now,
            status: normalizeTaskStatus(task.status),
            completedAt: getCompletedAtForStatus(task.status ?? "backlog", task.completedAt ?? null),
          }))

          tx.insert(tasks).values(
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
              completedAt: task.completedAt ?? null,
            }))
          ).run()

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
                testPullRequestUrl: branch.testPullRequestUrl ?? null,
                masterPullRequestUrl: branch.masterPullRequestUrl ?? null,
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
            tx.insert(serviceBranches).values(importedBranches).run()
          }
        }
      }

      if (importData.settings !== undefined) {
        const updateData: Partial<typeof settings.$inferInsert> = {}
        const source = importData.settings

        if (source.notifications !== undefined) updateData.notifications = source.notifications ? 1 : 0
        if (source.darkMode !== undefined) updateData.darkMode = source.darkMode ? 1 : 0
        if (source.compactView !== undefined) updateData.compactView = source.compactView ? 1 : 0
        if (source.showAssigneeAvatars !== undefined) updateData.showAssigneeAvatars = source.showAssigneeAvatars ? 1 : 0
        if (source.defaultPriority !== undefined) updateData.defaultPriority = source.defaultPriority
        if (source.branchPrefix !== undefined) updateData.branchPrefix = source.branchPrefix

        tx.update(settings).set(updateData).where(eq(settings.id, "singleton")).run()
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
