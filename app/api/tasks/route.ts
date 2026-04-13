import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, serviceBranches } from "@/lib/schema"

// Convert DB row to frontend Task shape
function toClientTask(task: typeof tasks.$inferSelect, branches: (typeof serviceBranches.$inferSelect)[]) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee: task.assigneeName ? { name: task.assigneeName, avatar: task.assigneeAvatar ?? undefined } : undefined,
    jiraUrl: task.jiraUrl ?? undefined,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    serviceBranches: branches.map((b) => ({
      id: b.id,
      taskId: b.taskId,
      serviceName: b.serviceName,
      branchName: b.branchName,
      pullRequestUrl: b.pullRequestUrl ?? undefined,
      mergedToTest: b.mergedToTest === 1,
      mergedToMaster: b.mergedToMaster === 1,
      testMergeDate: b.testMergeDate ?? undefined,
      masterMergeDate: b.masterMergeDate ?? undefined,
      lastCommit: b.lastCommit ?? undefined,
      lastStatusCheck: b.lastStatusCheck ?? undefined,
      prStatus: b.prStatus ? JSON.parse(b.prStatus) : undefined,
      diffStatus: b.diffStatus ? JSON.parse(b.diffStatus) : undefined,
      createdAt: b.createdAt,
    })),
  }
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
    const { title, description = "", status = "backlog", priority = "medium", assignee, jiraUrl } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: "任务标题不能为空" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    await db.insert(tasks).values({
      id,
      title: title.trim(),
      description,
      status,
      priority,
      assigneeName: assignee?.name ?? null,
      assigneeAvatar: assignee?.avatar ?? null,
      jiraUrl: jiraUrl ?? null,
      createdAt: now,
      updatedAt: now,
    })

    const created = await db.select().from(tasks).where(eq(tasks.id, id))
    return NextResponse.json(toClientTask(created[0], []), { status: 201 })
  } catch (error) {
    console.error("POST /api/tasks error:", error)
    return NextResponse.json({ error: "创建任务失败" }, { status: 500 })
  }
}
