import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, serviceBranches } from "@/lib/schema"
import { validateTaskList } from "@/lib/import-export"
import { toClientTask } from "@/lib/task-data"
import type { ServiceBranch, Task } from "@/lib/types"

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

      await db.delete(tasks)

      if (importedTasks.length > 0) {
        const now = new Date().toISOString()
        const normalizedTasks = importedTasks.map((task) => ({
          ...task,
          id: task.id || crypto.randomUUID(),
          createdAt: task.createdAt ?? now,
          updatedAt: task.updatedAt ?? now,
        }))

        await db.insert(tasks).values(
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
            }
          })
        )

        const importedBranches = normalizedTasks.flatMap((task) =>
          (task.serviceBranches ?? []).map((branch): typeof serviceBranches.$inferInsert => ({
            id: branch.id || crypto.randomUUID(),
            taskId: task.id,
            serviceName: branch.serviceName,
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
            createdAt: branch.createdAt ?? task.createdAt ?? new Date().toISOString(),
          }))
        )

        if (importedBranches.length > 0) {
          await db.insert(serviceBranches).values(importedBranches)
        }
      }

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
    })

    if (incomingBranches.length > 0) {
      await db.insert(serviceBranches).values(
        incomingBranches.map((branch) => ({
          id: branch.id || crypto.randomUUID(),
          taskId,
          serviceName: branch.serviceName,
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
          createdAt: branch.createdAt ?? createdAt ?? now,
        }))
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
