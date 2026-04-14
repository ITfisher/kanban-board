import { eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  pullRequests,
  repositories,
  serviceBranchStageSnapshots,
  services,
  taskBranchDevelopers,
  taskBranchServices,
  taskBranches,
} from "@/lib/schema"
import type { Task, TaskBranch } from "@/lib/types"

type TaskBranchDraft = {
  id?: string
  repositoryId: string
  name: string
  title?: string
  description?: string
  status?: TaskBranch["status"]
  createdByUserId?: string
  createdAt?: string
  updatedAt?: string
  closedAt?: string
  lastSyncedAt?: string
  serviceIds: string[]
  developerUserIds: string[]
}

type ReplaceTaskBranchesInput = {
  taskBranches?: Array<
    Partial<TaskBranch> & {
      branchName?: string
      serviceIds?: string[]
      services?: Array<{ id?: string } | string>
      developerUserIds?: string[]
      developers?: Array<{ id?: string } | string>
    }
  >
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function normalizeIdList(values: Array<{ id?: string } | string> | undefined): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  return unique(
    values
      .map((value) => (typeof value === "string" ? value : value?.id))
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
  )
}

async function buildTaskBranchDrafts(input: ReplaceTaskBranchesInput): Promise<TaskBranchDraft[]> {
  const repositoryRows = await db.select().from(repositories)
  const serviceRows = await db.select().from(services)
  const repositoryIds = new Set(repositoryRows.map((row) => row.id))
  const serviceById = new Map(serviceRows.map((row) => [row.id, row]))

  if (Array.isArray(input.taskBranches)) {
    return input.taskBranches.map((branch) => {
      const repositoryId = typeof branch.repositoryId === "string" ? branch.repositoryId : undefined
      const name =
        typeof branch.name === "string" && branch.name.trim()
          ? branch.name.trim()
          : typeof branch.branchName === "string" && branch.branchName.trim()
            ? branch.branchName.trim()
            : ""

      if (!repositoryId || !repositoryIds.has(repositoryId)) {
        throw new Error(`需求分支 "${name || "未命名分支"}" 缺少有效的 repositoryId`)
      }

      if (!name) {
        throw new Error("需求分支名称不能为空")
      }

      const serviceIds = unique([
        ...(Array.isArray(branch.serviceIds) ? branch.serviceIds : []),
        ...normalizeIdList(branch.services),
      ])

      for (const serviceId of serviceIds) {
        const serviceRow = serviceById.get(serviceId)
        if (!serviceRow) {
          throw new Error(`需求分支 "${name}" 关联了不存在的服务`)
        }

        if (serviceRow.repositoryId !== repositoryId) {
          throw new Error(`服务 "${serviceRow.name}" 与需求分支 "${name}" 不属于同一仓库`)
        }
      }

      return {
        id: branch.id,
        repositoryId,
        name,
        title: typeof branch.title === "string" ? branch.title : undefined,
        description: typeof branch.description === "string" ? branch.description : undefined,
        status: branch.status,
        createdByUserId: typeof branch.createdByUserId === "string" ? branch.createdByUserId : undefined,
        createdAt: typeof branch.createdAt === "string" ? branch.createdAt : undefined,
        updatedAt: typeof branch.updatedAt === "string" ? branch.updatedAt : undefined,
        closedAt: typeof branch.closedAt === "string" ? branch.closedAt : undefined,
        lastSyncedAt: typeof branch.lastSyncedAt === "string" ? branch.lastSyncedAt : undefined,
        serviceIds,
        developerUserIds: unique([
          ...(Array.isArray(branch.developerUserIds) ? branch.developerUserIds : []),
          ...normalizeIdList(branch.developers),
        ]),
      } satisfies TaskBranchDraft
    })
  }

  return []
}

export async function replaceTaskBranchesForTask(taskId: string, input: ReplaceTaskBranchesInput) {
  const drafts = await buildTaskBranchDrafts(input)
  const serviceRows = await db.select().from(services)
  const serviceById = new Map(serviceRows.map((row) => [row.id, row]))
  const existingBranches = await db.select().from(taskBranches).where(eq(taskBranches.taskId, taskId))
  const existingById = new Map(existingBranches.map((branch) => [branch.id, branch]))
  const existingByRepoAndName = new Map(existingBranches.map((branch) => [`${branch.repositoryId}::${branch.name}`, branch]))

  const now = new Date().toISOString()
  const normalizedDrafts = drafts.map((draft) => {
    const matchedExisting =
      (draft.id ? existingById.get(draft.id) : undefined) ??
      existingByRepoAndName.get(`${draft.repositoryId}::${draft.name}`)
    const id = matchedExisting?.id ?? draft.id ?? crypto.randomUUID()

    return {
      ...draft,
      id,
      createdAt: matchedExisting?.createdAt ?? draft.createdAt ?? now,
      updatedAt: draft.updatedAt ?? now,
      lastSyncedAt: draft.lastSyncedAt ?? matchedExisting?.lastSyncedAt ?? undefined,
    }
  })

  const keepIds = new Set(normalizedDrafts.map((draft) => draft.id))
  const removedBranchIds = existingBranches.filter((branch) => !keepIds.has(branch.id)).map((branch) => branch.id)

  db.transaction((tx) => {
    if (removedBranchIds.length > 0) {
      tx.delete(taskBranchServices).where(inArray(taskBranchServices.taskBranchId, removedBranchIds)).run()
      tx.delete(taskBranchDevelopers).where(inArray(taskBranchDevelopers.taskBranchId, removedBranchIds)).run()
      tx.delete(pullRequests).where(inArray(pullRequests.taskBranchId, removedBranchIds)).run()
      tx
        .delete(serviceBranchStageSnapshots)
        .where(inArray(serviceBranchStageSnapshots.taskBranchId, removedBranchIds))
        .run()
      tx.delete(taskBranches).where(inArray(taskBranches.id, removedBranchIds)).run()
    }

    for (const draft of normalizedDrafts) {
      tx
        .insert(taskBranches)
        .values({
          id: draft.id,
          taskId,
          repositoryId: draft.repositoryId,
          name: draft.name,
          title: draft.title ?? "",
          description: draft.description ?? "",
          status: draft.status ?? "active",
          createdByUserId: draft.createdByUserId ?? null,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
          closedAt: draft.closedAt ?? null,
          lastSyncedAt: draft.lastSyncedAt ?? null,
        })
        .onConflictDoUpdate({
          target: taskBranches.id,
          set: {
            repositoryId: draft.repositoryId,
            name: draft.name,
            title: draft.title ?? "",
            description: draft.description ?? "",
            status: draft.status ?? "active",
            createdByUserId: draft.createdByUserId ?? null,
            updatedAt: draft.updatedAt,
            closedAt: draft.closedAt ?? null,
            lastSyncedAt: draft.lastSyncedAt ?? null,
          },
        })
        .run()

      tx.delete(taskBranchServices).where(eq(taskBranchServices.taskBranchId, draft.id)).run()
      tx.delete(taskBranchDevelopers).where(eq(taskBranchDevelopers.taskBranchId, draft.id)).run()

      if (draft.serviceIds.length > 0) {
        tx
          .insert(taskBranchServices)
          .values(
            draft.serviceIds.map((serviceId) => {
              const serviceRow = serviceById.get(serviceId)
              if (!serviceRow?.repositoryId) {
                throw new Error("服务缺少 repositoryId，无法写入关联")
              }

              return {
                id: crypto.randomUUID(),
                taskBranchId: draft.id,
                serviceId,
                repositoryId: serviceRow.repositoryId,
                status: "active",
                createdAt: draft.createdAt,
                updatedAt: draft.updatedAt,
              }
            })
          )
          .run()
      }

      if (draft.developerUserIds.length > 0) {
        tx
          .insert(taskBranchDevelopers)
          .values(
            draft.developerUserIds.map((userId) => ({
              id: crypto.randomUUID(),
              taskBranchId: draft.id,
              userId,
              role: "developer",
              createdAt: draft.createdAt,
            }))
          )
          .run()
      }
    }
  })

  return normalizedDrafts
}

export function getCompletedAtForTaskStatus(status: Task["status"], previousCompletedAt?: string | null) {
  if (status === "done" || status === "closed") {
    return previousCompletedAt ?? new Date().toISOString()
  }

  return null
}
