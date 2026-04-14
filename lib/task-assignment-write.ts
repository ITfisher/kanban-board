"use server"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { taskAssignments, users } from "@/lib/schema"

type TaskOwnerInput = {
  ownerUserId?: string | null
  assignee?: {
    name?: string | null
    avatar?: string | null
  } | null
}

type TaskOwnerPersistence = {
  ownerUserId: string | null
  assigneeName: string | null
  assigneeAvatar: string | null
}

export async function resolveTaskOwnerPersistence(input: TaskOwnerInput): Promise<TaskOwnerPersistence> {
  const ownerUserId = input.ownerUserId?.trim()

  if (ownerUserId) {
    const matchedUsers = await db.select().from(users).where(eq(users.id, ownerUserId))
    const owner = matchedUsers[0]

    if (!owner) {
      throw new Error("负责人不存在，请先在用户管理中创建或重新选择负责人")
    }

    return {
      ownerUserId: owner.id,
      assigneeName: owner.name,
      assigneeAvatar: owner.avatarUrl ?? null,
    }
  }

  const assigneeName = input.assignee?.name?.trim()
  return {
    ownerUserId: null,
    assigneeName: assigneeName || null,
    assigneeAvatar: input.assignee?.avatar?.trim() || null,
  }
}

export async function syncTaskOwnerAssignment(taskId: string, ownerUserId?: string | null) {
  await db.delete(taskAssignments).where(eq(taskAssignments.taskId, taskId))

  const normalizedOwnerUserId = ownerUserId?.trim()
  if (!normalizedOwnerUserId) {
    return
  }

  await db.insert(taskAssignments).values({
    id: crypto.randomUUID(),
    taskId,
    userId: normalizedOwnerUserId,
    role: "owner",
    createdAt: new Date().toISOString(),
  })
}
