import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, serviceBranches, services } from "@/lib/schema"
import { validateTaskList } from "@/lib/import-export"
import { requireBranchService } from "@/lib/service-branch-utils"
import { isCompletedTaskStatus, normalizeTaskStatus } from "@/lib/task-status"
import { toClientTask } from "@/lib/task-data"
import type { ServiceBranch, Task } from "@/lib/types"

function getCompletedAtForStatus(status: Task["status"], previousCompletedAt?: string | null) {
  if (isCompletedTaskStatus(status)) {
    return previousCompletedAt ?? new Date().toISOString()
  }
  return null
}

export async function GET() {
  try {
    const allTasks = await db.select().from(tasks).orderBy(tasks.createdAt)
    const allBranches = await db.select().from(serviceBranches)

    const result = allTasks.map((task) => {
      const branches = allBranches.filter((b) => b.taskId === task.id)
      return toClientTask(task, branches)
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("GET /api/tasks error:", error)
    return NextResponse.json({ error: "获取任务列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      const importedTasks = validateTaskList(body)
      const existingServices = (await db.select().from(services)).map((service) => ({
        id: service.id,
        name: service.name,
      }))

      db.transaction((tx) => {
        tx.delete(serviceBranches).run()
        tx.delete(tasks).run()

        if (importedTasks.length > 0) {
          const now = new Date().toISOString()
          const normalizedTasks = importedTasks.map((task) => ({
            ...task,
            id: task.id || crypto.randomUUID(),
            createdAt: task.createdAt ?? now,
            updatedAt: task.updatedAt ?? now,
            status: normalizeTaskStatus(task.status),
            completedAt: getCompletedAtForStatus(normalizeTaskStatus(task.status), task.completedAt ?? null),
          }))

          tx.insert(tasks).values(
            normalizedTasks.map((task) => {
              return {
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
              }
            })
          ).run()

          const importedBranches = normalizedTasks.flatMap((task) =>
            (task.serviceBranches ?? []).map((branch): typeof serviceBranches.$inferInsert => {
              const normalizedService = requireBranchService(existingServices, branch)

              return {
                id: branch.id || crypto.randomUUID(),
                taskId: task.id,
                serviceId: normalizedService.serviceId ?? null,
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
                createdAt: branch.createdAt ?? task.createdAt ?? new Date().toISOString(),
              }
            })
          )

          if (importedBranches.length > 0) {
            tx.insert(serviceBranches).values(importedBranches).run()
          }
        }
      })

      const allTasks = await db.select().from(tasks).orderBy(tasks.createdAt)
      const allBranches = await db.select().from(serviceBranches)

      return NextResponse.json(
        allTasks.map((task) => toClientTask(task, allBranches.filter((branch) => branch.taskId === task.id))),
        { status: 201 }
      )
    }

    const {
      id,
      title,
      description = "",
      status = "backlog",
      priority = "medium",
      assignee,
      jiraUrl,
      createdAt,
      updatedAt,
      serviceBranches: incomingBranches = [],
    } = body as Task & { serviceBranches?: ServiceBranch[] }

    if (!title?.trim()) {
      return NextResponse.json({ error: "任务标题不能为空" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const taskId = id || crypto.randomUUID()
    const normalizedStatus = normalizeTaskStatus(status)
    const existingServices = (await db.select().from(services)).map((service) => ({
      id: service.id,
      name: service.name,
    }))

    await db.insert(tasks).values({
      id: taskId,
      title: title.trim(),
      description,
      status,
      priority,
      assigneeName: assignee?.name ?? null,
      assigneeAvatar: assignee?.avatar ?? null,
      jiraUrl: jiraUrl ?? null,
      createdAt: createdAt ?? now,
      updatedAt: updatedAt ?? now,
      completedAt: getCompletedAtForStatus(normalizedStatus, null),
    })

    if (incomingBranches.length > 0) {
      await db.insert(serviceBranches).values(
        incomingBranches.map((branch) => {
          const normalizedService = requireBranchService(existingServices, branch)

          return {
            id: branch.id || crypto.randomUUID(),
            taskId,
            serviceId: normalizedService.serviceId ?? null,
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
            createdAt: branch.createdAt ?? createdAt ?? now,
          }
        })
      )
    }

    const created = await db.select().from(tasks).where(eq(tasks.id, taskId))
    const createdBranches = await db.select().from(serviceBranches).where(eq(serviceBranches.taskId, taskId))
    return NextResponse.json(toClientTask(created[0], createdBranches), { status: 201 })
  } catch (error) {
    console.error("POST /api/tasks error:", error)
    return NextResponse.json({ error: "创建任务失败" }, { status: 500 })
  }
}
