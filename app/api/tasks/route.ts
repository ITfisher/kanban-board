import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listTaskPayloads } from "@/lib/domain-data"
import { validateTaskList } from "@/lib/import-export"
import { resolveTaskOwnerPersistence, syncTaskOwnerAssignment } from "@/lib/task-assignment-write"
import {
  pullRequests,
  serviceBranchStageSnapshots,
  taskAssignments,
  taskBranchDevelopers,
  taskBranchServices,
  taskBranches,
  tasks,
} from "@/lib/schema"
import { getCompletedAtForTaskStatus, replaceTaskBranchesForTask } from "@/lib/task-branch-write"
import { normalizeTaskStatus } from "@/lib/task-status"
import type { Task } from "@/lib/types"

export async function GET() {
  try {
    return NextResponse.json(await listTaskPayloads())
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
      const now = new Date().toISOString()
      const normalizedTasks = importedTasks.map((task) => ({
        ...task,
        id: task.id || crypto.randomUUID(),
        createdAt: task.createdAt ?? now,
        updatedAt: task.updatedAt ?? now,
        status: normalizeTaskStatus(task.status),
        completedAt: getCompletedAtForTaskStatus(normalizeTaskStatus(task.status), task.completedAt ?? null),
      }))

      db.transaction((tx) => {
        tx.delete(serviceBranchStageSnapshots).run()
        tx.delete(pullRequests).run()
        tx.delete(taskBranchDevelopers).run()
        tx.delete(taskBranchServices).run()
        tx.delete(taskBranches).run()
        tx.delete(taskAssignments).run()
        tx.delete(tasks).run()

        if (normalizedTasks.length > 0) {
          const taskRows = normalizedTasks.map((task) => {
            const assigneeName = task.assignee?.name?.trim() || null

            return {
              id: task.id,
              title: task.title.trim(),
              description: task.description ?? "",
              status: task.status ?? "backlog",
              priority: task.priority ?? "medium",
              ownerUserId: task.ownerUserId ?? null,
              assigneeName,
              assigneeAvatar: task.assignee?.avatar ?? null,
              jiraUrl: task.jiraUrl ?? null,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
              completedAt: task.completedAt ?? null,
            }
          })

          tx.insert(tasks).values(taskRows).run()

          const assignmentRows = normalizedTasks
            .filter((task) => task.ownerUserId)
            .map((task) => ({
              id: crypto.randomUUID(),
              taskId: task.id,
              userId: task.ownerUserId as string,
              role: "owner" as const,
              createdAt: task.updatedAt ?? task.createdAt ?? now,
            }))

          if (assignmentRows.length > 0) {
            tx.insert(taskAssignments).values(assignmentRows).run()
          }
        }
      })

      for (const task of normalizedTasks) {
        await replaceTaskBranchesForTask(task.id, {
          taskBranches: task.taskBranches as never,
        })
      }

      return NextResponse.json(await listTaskPayloads(), { status: 201 })
    }

    const {
      id,
      title,
      description = "",
      status = "backlog",
      priority = "medium",
      ownerUserId,
      assignee,
      jiraUrl,
      createdAt,
      updatedAt,
      taskBranches: incomingTaskBranches = [],
    } = body as Task

    if (!title?.trim()) {
      return NextResponse.json({ error: "任务标题不能为空" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const taskId = id || crypto.randomUUID()
    const normalizedStatus = normalizeTaskStatus(status)
    const ownerPersistence = await resolveTaskOwnerPersistence({ ownerUserId, assignee })

    await db.insert(tasks).values({
      id: taskId,
      title: title.trim(),
      description,
      status: normalizedStatus,
      priority,
      ownerUserId: ownerPersistence.ownerUserId,
      assigneeName: ownerPersistence.assigneeName,
      assigneeAvatar: ownerPersistence.assigneeAvatar,
      jiraUrl: jiraUrl ?? null,
      createdAt: createdAt ?? now,
      updatedAt: updatedAt ?? now,
      completedAt: getCompletedAtForTaskStatus(normalizedStatus, null),
    })

    await syncTaskOwnerAssignment(taskId, ownerPersistence.ownerUserId)

    if (incomingTaskBranches.length > 0) {
      await replaceTaskBranchesForTask(taskId, {
        taskBranches: incomingTaskBranches as never,
      })
    }

    const created = await listTaskPayloads(taskId)
    return NextResponse.json(created[0], { status: 201 })
  } catch (error) {
    console.error("POST /api/tasks error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建任务失败" },
      { status: 500 }
    )
  }
}
