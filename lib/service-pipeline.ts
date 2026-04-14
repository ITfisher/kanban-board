import { eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildRepositoryApiUrl, getGitHubConnection } from "@/lib/github-utils"
import {
  events,
  mergeOperations,
  pullRequests,
  repositories,
  serviceBranchStageSnapshots,
  serviceStages,
  services,
  syncRuns,
  taskBranchDevelopers,
  taskBranchServices,
  taskBranches,
  tasks,
  users,
} from "@/lib/schema"
import type { GateStatus, SnapshotPullRequestChecks, StageActionType, StageStatus, SyncRunStatus } from "@/lib/types"

type RepositoryRow = typeof repositories.$inferSelect
type ServiceRow = typeof services.$inferSelect
type ServiceStageRow = typeof serviceStages.$inferSelect
type TaskRow = typeof tasks.$inferSelect
type TaskBranchRow = typeof taskBranches.$inferSelect
type UserRow = typeof users.$inferSelect
type PullRequestRow = typeof pullRequests.$inferSelect
type SnapshotRow = typeof serviceBranchStageSnapshots.$inferSelect

type SnapshotRefreshFilters = {
  serviceId?: string
  taskBranchId?: string
  taskBranchIds?: string[]
}

type SyncFilters = SnapshotRefreshFilters & {
  repositoryId?: string
  actorUserId?: string
  reason?: string
}

type SyncSummary = {
  runId?: string
  status: SyncRunStatus
  refreshedSnapshots: number
  refreshedPullRequests: number
  skippedPullRequests: number
  failedPullRequests: number
}

type ComputedStageState = {
  stageStatus: StageStatus
  gateStatus: GateStatus
  isActionable: boolean
  actionType: StageActionType
}

type SnapshotContext = {
  now: string
  task: TaskRow | undefined
  taskBranch: TaskBranchRow
  service: ServiceRow
  stage: ServiceStageRow
  developers: UserRow[]
  latestPullRequest?: PullRequestRow
  previousStageSnapshot?: SnapshotRow
}

function sortStages(rows: ServiceStageRow[]): ServiceStageRow[] {
  return [...rows].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position
    }

    return left.name.localeCompare(right.name, "zh-CN")
  })
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? {})
}

function parseChecks(rawPayload?: string | null): SnapshotPullRequestChecks | undefined {
  if (!rawPayload) {
    return undefined
  }

  try {
    const parsed = JSON.parse(rawPayload) as {
      checks?: {
        state?: SnapshotPullRequestChecks["state"]
        total_count?: number
        completed_count?: number
        failed_count?: number
      }
    }
    const checks = parsed?.checks
    if (!checks) {
      return undefined
    }

    return {
      state: checks.state,
      totalCount: checks.total_count,
      completedCount: checks.completed_count,
      failedCount: checks.failed_count,
    }
  } catch {
    return undefined
  }
}

function getSnapshotId(serviceId: string, taskBranchId: string, stageId: string) {
  return `${serviceId}:${taskBranchId}:${stageId}`
}

function extractPullRequestNumber(record: PullRequestRow): number | undefined {
  if (typeof record.externalNumber === "number") {
    return record.externalNumber
  }

  if (!record.htmlUrl) {
    return undefined
  }

  const match = record.htmlUrl.match(/\/pull\/(\d+)/)
  return match ? Number(match[1]) : undefined
}

function isMergedPullRequest(record?: PullRequestRow) {
  return Boolean(record && (record.merged === 1 || record.state === "merged"))
}

function isOpenPullRequest(record?: PullRequestRow) {
  return Boolean(record && !isMergedPullRequest(record) && record.state === "open")
}

function isClosedPullRequest(record?: PullRequestRow) {
  return Boolean(record && !isMergedPullRequest(record) && record.state === "closed")
}

function isBlockedMergeable(record?: PullRequestRow) {
  if (!record || !isOpenPullRequest(record)) {
    return false
  }

  if (record.mergeable === 0) {
    return true
  }

  return ["blocked", "dirty", "draft", "behind", "unstable"].includes(record.mergeableState ?? "")
}

function getActiveStages(stageRows: ServiceStageRow[], serviceId: string) {
  return sortStages(stageRows.filter((stage) => stage.serviceId === serviceId && stage.isActive === 1))
}

export function getPreviousActiveStage(stageRows: ServiceStageRow[], serviceId: string, stageId: string) {
  const activeStages = getActiveStages(stageRows, serviceId)
  const currentIndex = activeStages.findIndex((stage) => stage.id === stageId)
  return currentIndex > 0 ? activeStages[currentIndex - 1] : undefined
}

export function computeStageGateState({
  latestPullRequest,
  previousStageSnapshot,
}: Pick<SnapshotContext, "latestPullRequest" | "previousStageSnapshot">): ComputedStageState {
  const previousMerged =
    !previousStageSnapshot ||
    previousStageSnapshot.stageStatus === "merged" ||
    previousStageSnapshot.gateStatus === "merged"
  const previousBlocked =
    previousStageSnapshot?.stageStatus === "blocked" ||
    previousStageSnapshot?.gateStatus === "blocked" ||
    previousStageSnapshot?.stageStatus === "closed"
  const currentMerged = isMergedPullRequest(latestPullRequest)
  const currentOpen = isOpenPullRequest(latestPullRequest)
  const currentClosed = isClosedPullRequest(latestPullRequest)
  const mergeBlocked = isBlockedMergeable(latestPullRequest)

  if (currentMerged) {
    return {
      stageStatus: "merged",
      gateStatus: "merged",
      isActionable: Boolean(latestPullRequest?.htmlUrl),
      actionType: latestPullRequest?.htmlUrl ? "view_pr" : "noop",
    }
  }

  if (currentOpen) {
    return {
      stageStatus: "in_progress",
      gateStatus: previousMerged ? (mergeBlocked ? "blocked" : "ready") : previousBlocked ? "blocked" : "pending",
      isActionable: Boolean(latestPullRequest?.htmlUrl),
      actionType: latestPullRequest?.htmlUrl ? "view_pr" : "sync",
    }
  }

  if (currentClosed) {
    return {
      stageStatus: "closed",
      gateStatus: previousMerged ? "ready" : previousBlocked ? "blocked" : "pending",
      isActionable: previousMerged,
      actionType: previousMerged ? "create_pr" : "sync",
    }
  }

  if (previousMerged) {
    return {
      stageStatus: "ready",
      gateStatus: "ready",
      isActionable: true,
      actionType: "create_pr",
    }
  }

  return {
    stageStatus: previousBlocked ? "blocked" : "idle",
    gateStatus: previousBlocked ? "blocked" : "pending",
    isActionable: false,
    actionType: previousBlocked ? "sync" : "noop",
  }
}

function hasSnapshotChanged(previous: SnapshotRow | undefined, next: typeof serviceBranchStageSnapshots.$inferInsert) {
  if (!previous) {
    return true
  }

  return (
    previous.stageStatus !== next.stageStatus ||
    previous.gateStatus !== next.gateStatus ||
    previous.isActionable !== next.isActionable ||
    (previous.actionType ?? null) !== (next.actionType ?? null) ||
    (previous.latestPullRequestId ?? null) !== (next.latestPullRequestId ?? null) ||
    (previous.latestPullRequestNumber ?? null) !== (next.latestPullRequestNumber ?? null) ||
    (previous.latestPullRequestState ?? null) !== (next.latestPullRequestState ?? null) ||
    (previous.latestPullRequestUrl ?? null) !== (next.latestPullRequestUrl ?? null) ||
    (previous.latestPullRequestTitle ?? null) !== (next.latestPullRequestTitle ?? null) ||
    (previous.latestPullRequestMergeable ?? null) !== (next.latestPullRequestMergeable ?? null) ||
    (previous.latestPullRequestMergeableState ?? null) !== (next.latestPullRequestMergeableState ?? null) ||
    (previous.latestPullRequestDraft ?? null) !== (next.latestPullRequestDraft ?? null) ||
    (previous.latestPullRequestChecks ?? null) !== (next.latestPullRequestChecks ?? null) ||
    (previous.lastSyncedAt ?? null) !== (next.lastSyncedAt ?? null) ||
    previous.taskTitle !== next.taskTitle ||
    previous.taskStatus !== next.taskStatus ||
    previous.branchName !== next.branchName ||
    previous.developerUserIds !== next.developerUserIds ||
    previous.developerNames !== next.developerNames
  )
}

function buildSnapshotRow(context: SnapshotContext) {
  const state = computeStageGateState(context)
  const latestPullRequestNumber = context.latestPullRequest ? extractPullRequestNumber(context.latestPullRequest) : undefined
  const latestPullRequestState = context.latestPullRequest
    ? context.latestPullRequest.merged === 1
      ? "merged"
      : context.latestPullRequest.state
    : null
  const latestPullRequestChecks = context.latestPullRequest ? parseChecks(context.latestPullRequest.rawPayload) : undefined

  return {
    id: getSnapshotId(context.service.id, context.taskBranch.id, context.stage.id),
    repositoryId: context.taskBranch.repositoryId,
    serviceId: context.service.id,
    taskId: context.taskBranch.taskId,
    taskBranchId: context.taskBranch.id,
    serviceStageId: context.stage.id,
    stageStatus: state.stageStatus,
    gateStatus: state.gateStatus,
    isActionable: state.isActionable ? 1 : 0,
    actionType: state.actionType,
    latestPullRequestId: context.latestPullRequest?.id ?? null,
    latestPullRequestNumber: latestPullRequestNumber ?? null,
    latestPullRequestState,
    latestPullRequestUrl: context.latestPullRequest?.htmlUrl ?? null,
    latestPullRequestTitle: context.latestPullRequest?.title ?? null,
    latestPullRequestMergeable:
      context.latestPullRequest?.mergeable === null || context.latestPullRequest?.mergeable === undefined
        ? null
        : context.latestPullRequest.mergeable,
    latestPullRequestMergeableState: context.latestPullRequest?.mergeableState ?? null,
    latestPullRequestDraft: context.latestPullRequest?.draft ?? null,
    latestPullRequestChecks: latestPullRequestChecks ? JSON.stringify(latestPullRequestChecks) : null,
    taskTitle: context.task?.title ?? context.taskBranch.title ?? "",
    taskStatus: context.task?.status ?? "backlog",
    branchName: context.taskBranch.name,
    developerUserIds: JSON.stringify(context.developers.map((developer) => developer.id)),
    developerNames: JSON.stringify(context.developers.map((developer) => developer.name)),
    lastSyncedAt: context.latestPullRequest?.lastSyncedAt ?? context.taskBranch.lastSyncedAt ?? null,
    updatedAt: context.now,
  } satisfies typeof serviceBranchStageSnapshots.$inferInsert
}

async function writeAuditEvents(rows: Array<typeof events.$inferInsert>) {
  if (rows.length === 0) {
    return
  }

  await db.insert(events).values(rows)
}

async function writeSnapshotAuditEvents(
  now: string,
  previous: SnapshotRow | undefined,
  next: typeof serviceBranchStageSnapshots.$inferInsert,
  actorUserId?: string
) {
  const nextGateStatus = next.gateStatus ?? "unknown"
  const auditRows: Array<typeof events.$inferInsert> = [
    {
      id: crypto.randomUUID(),
      repositoryId: next.repositoryId,
      taskId: next.taskId,
      taskBranchId: next.taskBranchId,
      serviceId: next.serviceId,
      serviceStageId: next.serviceStageId,
      pullRequestId: next.latestPullRequestId ?? null,
      actorUserId: actorUserId ?? null,
      eventType: "snapshot.refreshed",
      summary: `阶段快照已刷新为 ${next.stageStatus}/${next.gateStatus}`,
      payload: toJson({
        previous: previous
          ? {
              stageStatus: previous.stageStatus,
              gateStatus: previous.gateStatus,
              isActionable: previous.isActionable === 1,
              actionType: previous.actionType,
            }
          : null,
        current: {
          stageStatus: next.stageStatus,
          gateStatus: next.gateStatus,
          isActionable: next.isActionable === 1,
          actionType: next.actionType,
        },
      }),
      occurredAt: now,
      createdAt: now,
    },
  ]

  if (previous?.gateStatus !== "blocked" && next.gateStatus === "blocked") {
    auditRows.push({
      id: crypto.randomUUID(),
      repositoryId: next.repositoryId,
      taskId: next.taskId,
      taskBranchId: next.taskBranchId,
      serviceId: next.serviceId,
      serviceStageId: next.serviceStageId,
      pullRequestId: next.latestPullRequestId ?? null,
      actorUserId: actorUserId ?? null,
      eventType: "stage.blocked",
      summary: "阶段门禁进入阻塞状态",
      payload: toJson({
        stageStatus: next.stageStatus,
        gateStatus: next.gateStatus,
        latestPullRequestId: next.latestPullRequestId,
      }),
      occurredAt: now,
      createdAt: now,
    })
  }

  if (
    previous &&
    !["ready", "merged"].includes(previous.gateStatus) &&
    ["ready", "merged"].includes(nextGateStatus)
  ) {
    auditRows.push({
      id: crypto.randomUUID(),
      repositoryId: next.repositoryId,
      taskId: next.taskId,
      taskBranchId: next.taskBranchId,
      serviceId: next.serviceId,
      serviceStageId: next.serviceStageId,
      pullRequestId: next.latestPullRequestId ?? null,
      actorUserId: actorUserId ?? null,
      eventType: "stage.advanced",
      summary: "阶段门禁已满足，可继续流转",
      payload: toJson({
        previousGateStatus: previous.gateStatus,
        gateStatus: next.gateStatus,
        stageStatus: next.stageStatus,
      }),
      occurredAt: now,
      createdAt: now,
    })
  }

  await writeAuditEvents(auditRows)
}

export async function refreshServiceBranchStageSnapshots(
  filters: SnapshotRefreshFilters & { actorUserId?: string } = {}
) {
  const now = new Date().toISOString()
  const [taskRows, branchRows, branchServiceRows, serviceRows, stageRows, developerRows, userRows, pullRequestRows, snapshotRows] =
    await Promise.all([
      db.select().from(tasks),
      db.select().from(taskBranches),
      db.select().from(taskBranchServices),
      db.select().from(services),
      db.select().from(serviceStages),
      db.select().from(taskBranchDevelopers),
      db.select().from(users),
      db.select().from(pullRequests),
      db.select().from(serviceBranchStageSnapshots),
    ])

  const requestedBranchIds = new Set((filters.taskBranchIds ?? []).filter(Boolean))
  if (filters.taskBranchId) {
    requestedBranchIds.add(filters.taskBranchId)
  }

  const relevantBranchServices = branchServiceRows.filter((row) => {
    if (filters.serviceId && row.serviceId !== filters.serviceId) {
      return false
    }

    if (requestedBranchIds.size > 0 && !requestedBranchIds.has(row.taskBranchId)) {
      return false
    }

    return row.status !== "removed"
  })

  if (relevantBranchServices.length === 0) {
    return { refreshedSnapshots: 0 }
  }

  const branchIds = new Set(relevantBranchServices.map((row) => row.taskBranchId))
  const serviceIds = new Set(relevantBranchServices.map((row) => row.serviceId))
  const taskMap = new Map(taskRows.map((row) => [row.id, row]))
  const branchMap = new Map(branchRows.filter((row) => branchIds.has(row.id)).map((row) => [row.id, row]))
  const serviceMap = new Map(serviceRows.filter((row) => serviceIds.has(row.id)).map((row) => [row.id, row]))
  const developerMap = new Map<string, UserRow[]>()
  const userMap = new Map(userRows.map((row) => [row.id, row]))
  const latestPullRequestMap = new Map<string, PullRequestRow>()
  const existingSnapshotMap = new Map(snapshotRows.map((row) => [row.id, row]))

  for (const developerRow of developerRows) {
    if (!branchIds.has(developerRow.taskBranchId)) {
      continue
    }

    const developer = userMap.get(developerRow.userId)
    if (!developer) {
      continue
    }

    const current = developerMap.get(developerRow.taskBranchId) ?? []
    current.push(developer)
    developerMap.set(developerRow.taskBranchId, current)
  }

  for (const record of pullRequestRows) {
    if (!branchIds.has(record.taskBranchId) || !serviceIds.has(record.serviceId)) {
      continue
    }

    const key = `${record.taskBranchId}:${record.serviceId}:${record.serviceStageId}`
    const existing = latestPullRequestMap.get(key)
    if (!existing || `${record.updatedAt}|${record.createdAt}` > `${existing.updatedAt}|${existing.createdAt}`) {
      latestPullRequestMap.set(key, record)
    }
  }

  const activeStagesByService = new Map<string, ServiceStageRow[]>()
  for (const serviceId of serviceIds) {
    activeStagesByService.set(serviceId, getActiveStages(stageRows, serviceId))
  }

  const validSnapshotIds = new Set<string>()
  let refreshedSnapshots = 0

  for (const branchServiceRow of relevantBranchServices) {
    const taskBranch = branchMap.get(branchServiceRow.taskBranchId)
    const service = serviceMap.get(branchServiceRow.serviceId)
    if (!taskBranch || !service) {
      continue
    }

    const task = taskMap.get(taskBranch.taskId)
    const developers = developerMap.get(taskBranch.id) ?? []
    const activeStages = activeStagesByService.get(service.id) ?? []
    let previousStageSnapshot: SnapshotRow | undefined

    for (const stage of activeStages) {
      const latestPullRequest = latestPullRequestMap.get(`${taskBranch.id}:${service.id}:${stage.id}`)
      const snapshotRow = buildSnapshotRow({
        now,
        task,
        taskBranch,
        service,
        stage,
        developers,
        latestPullRequest,
        previousStageSnapshot,
      })
      const previous = existingSnapshotMap.get(snapshotRow.id)

      validSnapshotIds.add(snapshotRow.id)

      await db
        .insert(serviceBranchStageSnapshots)
        .values(snapshotRow)
        .onConflictDoUpdate({
          target: serviceBranchStageSnapshots.id,
          set: {
            stageStatus: snapshotRow.stageStatus,
            gateStatus: snapshotRow.gateStatus,
            isActionable: snapshotRow.isActionable,
            actionType: snapshotRow.actionType,
            latestPullRequestId: snapshotRow.latestPullRequestId,
            latestPullRequestNumber: snapshotRow.latestPullRequestNumber,
            latestPullRequestState: snapshotRow.latestPullRequestState,
            latestPullRequestUrl: snapshotRow.latestPullRequestUrl,
            latestPullRequestTitle: snapshotRow.latestPullRequestTitle,
            latestPullRequestMergeable: snapshotRow.latestPullRequestMergeable,
            latestPullRequestMergeableState: snapshotRow.latestPullRequestMergeableState,
            latestPullRequestDraft: snapshotRow.latestPullRequestDraft,
            latestPullRequestChecks: snapshotRow.latestPullRequestChecks,
            taskTitle: snapshotRow.taskTitle,
            taskStatus: snapshotRow.taskStatus,
            branchName: snapshotRow.branchName,
            developerUserIds: snapshotRow.developerUserIds,
            developerNames: snapshotRow.developerNames,
            lastSyncedAt: snapshotRow.lastSyncedAt,
            updatedAt: snapshotRow.updatedAt,
          },
        })

      if (hasSnapshotChanged(previous, snapshotRow)) {
        refreshedSnapshots += 1
        await writeSnapshotAuditEvents(now, previous, snapshotRow, filters.actorUserId)
      }

      previousStageSnapshot = {
        ...(previous ?? (snapshotRow as SnapshotRow)),
        stageStatus: snapshotRow.stageStatus,
        gateStatus: snapshotRow.gateStatus,
        isActionable: snapshotRow.isActionable,
        actionType: snapshotRow.actionType,
      } as SnapshotRow
    }
  }

  const staleSnapshotIds = snapshotRows
    .filter((row) => {
      if (filters.serviceId && row.serviceId !== filters.serviceId) {
        return false
      }

      if (requestedBranchIds.size > 0 && !requestedBranchIds.has(row.taskBranchId)) {
        return false
      }

      return !validSnapshotIds.has(row.id)
    })
    .map((row) => row.id)

  if (staleSnapshotIds.length > 0) {
    await db.delete(serviceBranchStageSnapshots).where(inArray(serviceBranchStageSnapshots.id, staleSnapshotIds))
  }

  return { refreshedSnapshots }
}

async function fetchPullRequestStatus(record: PullRequestRow, repository: RepositoryRow) {
  const number = extractPullRequestNumber(record)
  if (!number) {
    return { skipped: true as const, reason: "missing_pr_number" }
  }

  const connection = await getGitHubConnection({
    repositoryId: repository.id,
    preferredDomain: repository.domain,
  })
  if (!connection) {
    return { skipped: true as const, reason: "missing_scm_connection" }
  }

  const target = {
    repositoryId: repository.id,
    provider: repository.provider as "github" | "github-enterprise",
    domain: repository.domain,
    owner: repository.owner,
    repo: repository.slug || repository.name,
  }

  const headers = {
    Authorization: `Bearer ${connection.token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Kanban-Board-App/1.0.0",
  }
  const baseUrl = buildRepositoryApiUrl(connection, target)
  const prResponse = await fetch(`${baseUrl}/pulls/${number}`, {
    headers,
    signal: AbortSignal.timeout(10000),
  })

  if (!prResponse.ok) {
    throw new Error(`获取 PR #${number} 状态失败: ${prResponse.status}`)
  }

  const prData = await prResponse.json()
  let checks: unknown = null

  try {
    const checksResponse = await fetch(`${baseUrl}/commits/${prData.head.sha}/check-runs`, {
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (checksResponse.ok) {
      const payload = await checksResponse.json()
      const totalCount = payload.total_count || 0
      const completedCount = payload.check_runs?.filter((item: { status: string }) => item.status === "completed").length || 0
      const failedCount =
        payload.check_runs?.filter((item: { conclusion: string | null }) => item.conclusion === "failure" || item.conclusion === "error")
          .length || 0

      checks = {
        total_count: totalCount,
        completed_count: completedCount,
        failed_count: failedCount,
        state: totalCount === 0 ? "success" : completedCount < totalCount ? "pending" : failedCount > 0 ? "failure" : "success",
      }
    }
  } catch {
    // check runs are best-effort
  }

  return {
    skipped: false as const,
    now: new Date().toISOString(),
    data: prData,
    checks,
  }
}

function buildPullRequestSyncEvents(args: {
  now: string
  before: PullRequestRow
  after: typeof pullRequests.$inferInsert
  actorUserId?: string
}): Array<typeof events.$inferInsert> {
  const beforeState = isMergedPullRequest(args.before) ? "merged" : args.before.state
  const afterState = args.after.state
  const rows: Array<typeof events.$inferInsert> = [
    {
      id: crypto.randomUUID(),
      repositoryId: args.after.repositoryId,
      taskId: null,
      taskBranchId: args.after.taskBranchId,
      serviceId: args.after.serviceId,
      serviceStageId: args.after.serviceStageId,
      pullRequestId: args.after.id,
      actorUserId: args.actorUserId ?? null,
      eventType: "pull_request.synced",
      summary: `PR 状态已同步为 ${afterState}`,
      payload: toJson({
        previousState: beforeState,
        state: afterState,
        merged: args.after.merged === 1,
        mergeable: args.after.mergeable,
        mergeableState: args.after.mergeableState,
      }),
      occurredAt: args.now,
      createdAt: args.now,
    },
  ]

  if (beforeState !== "merged" && afterState === "merged") {
    rows.push({
      id: crypto.randomUUID(),
      repositoryId: args.after.repositoryId,
      taskId: null,
      taskBranchId: args.after.taskBranchId,
      serviceId: args.after.serviceId,
      serviceStageId: args.after.serviceStageId,
      pullRequestId: args.after.id,
      actorUserId: args.actorUserId ?? null,
      eventType: "pull_request.merged",
      summary: "PR 已合并",
      payload: toJson({
        mergedAt: args.after.mergedAt,
        targetBranch: args.after.targetBranch,
      }),
      occurredAt: args.now,
      createdAt: args.now,
    })
  } else if (beforeState === "merged" && afterState !== "merged") {
    rows.push({
      id: crypto.randomUUID(),
      repositoryId: args.after.repositoryId,
      taskId: null,
      taskBranchId: args.after.taskBranchId,
      serviceId: args.after.serviceId,
      serviceStageId: args.after.serviceStageId,
      pullRequestId: args.after.id,
      actorUserId: args.actorUserId ?? null,
      eventType: "pull_request.merge_reverted",
      summary: "PR 合并状态已撤销",
      payload: toJson({
        previousState: beforeState,
        state: afterState,
        targetBranch: args.after.targetBranch,
        mergedAt: args.after.mergedAt,
      }),
      occurredAt: args.now,
      createdAt: args.now,
    })
  } else if (beforeState === "open" && afterState === "closed") {
    rows.push({
      id: crypto.randomUUID(),
      repositoryId: args.after.repositoryId,
      taskId: null,
      taskBranchId: args.after.taskBranchId,
      serviceId: args.after.serviceId,
      serviceStageId: args.after.serviceStageId,
      pullRequestId: args.after.id,
      actorUserId: args.actorUserId ?? null,
      eventType: "pull_request.closed",
      summary: "PR 已关闭",
      payload: toJson({
        targetBranch: args.after.targetBranch,
      }),
      occurredAt: args.now,
      createdAt: args.now,
    })
  } else if (beforeState === "closed" && afterState === "open") {
    rows.push({
      id: crypto.randomUUID(),
      repositoryId: args.after.repositoryId,
      taskId: null,
      taskBranchId: args.after.taskBranchId,
      serviceId: args.after.serviceId,
      serviceStageId: args.after.serviceStageId,
      pullRequestId: args.after.id,
      actorUserId: args.actorUserId ?? null,
      eventType: "pull_request.reopened",
      summary: "PR 已重新打开",
      payload: toJson({
        targetBranch: args.after.targetBranch,
      }),
      occurredAt: args.now,
      createdAt: args.now,
    })
  }

  return rows
}

export async function recordPullRequestCreated(input: {
  repositoryId: string
  taskId?: string
  taskBranchId: string
  serviceId: string
  serviceStageId: string
  pullRequestId: string
  title?: string
  targetBranch?: string
  actorUserId?: string
}) {
  const now = new Date().toISOString()
  await writeAuditEvents([
    {
      id: crypto.randomUUID(),
      repositoryId: input.repositoryId,
      taskId: input.taskId ?? null,
      taskBranchId: input.taskBranchId,
      serviceId: input.serviceId,
      serviceStageId: input.serviceStageId,
      pullRequestId: input.pullRequestId,
      actorUserId: input.actorUserId ?? null,
      eventType: "pull_request.created",
      summary: `已创建阶段 PR${input.title ? `：${input.title}` : ""}`,
      payload: toJson({
        title: input.title,
        targetBranch: input.targetBranch,
      }),
      occurredAt: now,
      createdAt: now,
    },
  ])
}

export async function runServicePipelineSync(filters: SyncFilters = {}): Promise<SyncSummary> {
  const startedAt = new Date().toISOString()
  const runId = crypto.randomUUID()

  await db.insert(syncRuns).values({
    id: runId,
    repositoryId: filters.repositoryId ?? null,
    serviceId: filters.serviceId ?? null,
    taskBranchId: filters.taskBranchId ?? null,
    scope: filters.taskBranchId ? "task_branch" : filters.serviceId ? "service" : "repository",
    status: "running",
    summary: filters.reason ?? "服务流水线同步开始",
    payload: toJson({ filters }),
    startedAt,
    completedAt: null,
    createdAt: startedAt,
    updatedAt: startedAt,
  })

  let refreshedPullRequests = 0
  let skippedPullRequests = 0
  let failedPullRequests = 0

  try {
    const [repositoryRows, pullRequestRows, branchRows] = await Promise.all([
      db.select().from(repositories),
      db.select().from(pullRequests),
      db.select().from(taskBranches),
    ])

    const requestedBranchIds = new Set((filters.taskBranchIds ?? []).filter(Boolean))
    if (filters.taskBranchId) {
      requestedBranchIds.add(filters.taskBranchId)
    }

    const branchMap = new Map(branchRows.map((row) => [row.id, row]))
    const repositoryMap = new Map(repositoryRows.map((row) => [row.id, row]))
    const relevantPullRequests = pullRequestRows.filter((row) => {
      if (filters.repositoryId && row.repositoryId !== filters.repositoryId) {
        return false
      }

      if (filters.serviceId && row.serviceId !== filters.serviceId) {
        return false
      }

      if (requestedBranchIds.size > 0 && !requestedBranchIds.has(row.taskBranchId)) {
        return false
      }

      return true
    })

    for (const record of relevantPullRequests) {
      const repository = repositoryMap.get(record.repositoryId)
      if (!repository) {
        skippedPullRequests += 1
        continue
      }

      try {
        const result = await fetchPullRequestStatus(record, repository)
        if (result.skipped) {
          skippedPullRequests += 1
          continue
        }

        const after = {
          id: record.id,
          repositoryId: record.repositoryId,
          taskBranchId: record.taskBranchId,
          serviceId: record.serviceId,
          serviceStageId: record.serviceStageId,
          provider: record.provider,
          providerDomain: record.providerDomain,
          externalNumber: result.data.number ?? record.externalNumber,
          title: result.data.title ?? record.title,
          htmlUrl: result.data.html_url ?? record.htmlUrl,
          sourceBranch: result.data.head?.ref ?? record.sourceBranch,
          targetBranch: result.data.base?.ref ?? record.targetBranch,
          state: result.data.merged ? "merged" : result.data.state,
          merged: result.data.merged ? 1 : 0,
          mergeable: result.data.mergeable === null || result.data.mergeable === undefined ? null : result.data.mergeable ? 1 : 0,
          mergeableState: result.data.mergeable_state ?? null,
          headSha: result.data.head?.sha ?? record.headSha ?? null,
          baseSha: result.data.base?.sha ?? record.baseSha ?? null,
          draft: result.data.draft ? 1 : 0,
          authorUserId: record.authorUserId ?? null,
          rawPayload: toJson({
            pull_request: result.data,
            checks: result.checks,
          }),
          createdAt: record.createdAt,
          updatedAt: result.data.updated_at ?? result.now,
          closedAt: result.data.closed_at ?? null,
          mergedAt: result.data.merged_at ?? null,
          lastSyncedAt: result.now,
        } satisfies typeof pullRequests.$inferInsert

        await db
          .update(pullRequests)
          .set({
            externalNumber: after.externalNumber,
            title: after.title,
            htmlUrl: after.htmlUrl,
            sourceBranch: after.sourceBranch,
            targetBranch: after.targetBranch,
            state: after.state,
            merged: after.merged,
            mergeable: after.mergeable,
            mergeableState: after.mergeableState,
            headSha: after.headSha,
            baseSha: after.baseSha,
            draft: after.draft,
            rawPayload: after.rawPayload,
            updatedAt: after.updatedAt,
            closedAt: after.closedAt,
            mergedAt: after.mergedAt,
            lastSyncedAt: after.lastSyncedAt,
          })
          .where(eq(pullRequests.id, record.id))

        await writeAuditEvents(
          buildPullRequestSyncEvents({
            now: result.now,
            before: record,
            after,
            actorUserId: filters.actorUserId,
          })
        )

        if (!isMergedPullRequest(record) && after.state === "merged") {
          const taskBranch = branchMap.get(record.taskBranchId)
          await db.insert(mergeOperations).values({
            id: crypto.randomUUID(),
            repositoryId: record.repositoryId,
            taskId: taskBranch?.taskId ?? null,
            taskBranchId: record.taskBranchId,
            serviceId: record.serviceId,
            serviceStageId: record.serviceStageId,
            pullRequestId: record.id,
            operationType: "pull_request_merge",
            status: "completed",
            summary: `检测到 PR #${after.externalNumber ?? ""} 已合并到 ${after.targetBranch}`.trim(),
            payload: toJson({
              mergedAt: after.mergedAt,
              targetBranch: after.targetBranch,
              sourceBranch: after.sourceBranch,
            }),
            startedAt: result.now,
            completedAt: result.now,
            createdAt: result.now,
            updatedAt: result.now,
          })
        } else if (isMergedPullRequest(record) && after.state !== "merged") {
          const taskBranch = branchMap.get(record.taskBranchId)
          await db.insert(mergeOperations).values({
            id: crypto.randomUUID(),
            repositoryId: record.repositoryId,
            taskId: taskBranch?.taskId ?? null,
            taskBranchId: record.taskBranchId,
            serviceId: record.serviceId,
            serviceStageId: record.serviceStageId,
            pullRequestId: record.id,
            operationType: "pull_request_revert",
            status: "completed",
            summary: `检测到 PR #${after.externalNumber ?? ""} 的合并状态已撤销`.trim(),
            payload: toJson({
              previousState: "merged",
              state: after.state,
              mergedAt: after.mergedAt,
              targetBranch: after.targetBranch,
              sourceBranch: after.sourceBranch,
            }),
            startedAt: result.now,
            completedAt: result.now,
            createdAt: result.now,
            updatedAt: result.now,
          })
        }

        refreshedPullRequests += 1
      } catch (error) {
        failedPullRequests += 1
        console.error("runServicePipelineSync refresh PR error:", error)
      }
    }

    const refreshed = await refreshServiceBranchStageSnapshots({
      serviceId: filters.serviceId,
      taskBranchId: filters.taskBranchId,
      taskBranchIds: filters.taskBranchIds,
      actorUserId: filters.actorUserId,
    })

    const completedAt = new Date().toISOString()
    const status: SyncRunStatus =
      failedPullRequests > 0
        ? refreshedPullRequests > 0 || skippedPullRequests > 0
          ? "partial"
          : "failed"
        : refreshedPullRequests === 0 && skippedPullRequests > 0
          ? "skipped"
          : "completed"

    await db
      .update(syncRuns)
      .set({
        status,
        summary: `同步完成：PR ${refreshedPullRequests} 条，跳过 ${skippedPullRequests} 条，失败 ${failedPullRequests} 条`,
        payload: toJson({
          refreshedPullRequests,
          skippedPullRequests,
          failedPullRequests,
          refreshedSnapshots: refreshed.refreshedSnapshots,
        }),
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(syncRuns.id, runId))

    if (refreshedPullRequests > 0 || skippedPullRequests > 0 || failedPullRequests > 0) {
      await writeAuditEvents([
        {
          id: crypto.randomUUID(),
          repositoryId: filters.repositoryId ?? null,
          taskId: null,
          taskBranchId: filters.taskBranchId ?? null,
          serviceId: filters.serviceId ?? null,
          serviceStageId: null,
          pullRequestId: null,
          actorUserId: filters.actorUserId ?? null,
          eventType: "sync.completed",
          summary: `同步完成，状态为 ${status}`,
          payload: toJson({
            runId,
            refreshedPullRequests,
            skippedPullRequests,
            failedPullRequests,
            refreshedSnapshots: refreshed.refreshedSnapshots,
          }),
          occurredAt: completedAt,
          createdAt: completedAt,
        },
      ])
    }

    if (refreshedPullRequests > 0) {
      const touchedBranchIds = [...new Set(relevantPullRequests.map((row) => row.taskBranchId))]
      await Promise.all(
        touchedBranchIds.map((branchId) =>
          db
            .update(taskBranches)
            .set({
              lastSyncedAt: completedAt,
              updatedAt: completedAt,
            })
            .where(eq(taskBranches.id, branchId))
        )
      )
    }

    return {
      runId,
      status,
      refreshedSnapshots: refreshed.refreshedSnapshots,
      refreshedPullRequests,
      skippedPullRequests,
      failedPullRequests,
    }
  } catch (error) {
    const completedAt = new Date().toISOString()
    await db
      .update(syncRuns)
      .set({
        status: "failed",
        summary: error instanceof Error ? error.message : "服务流水线同步失败",
        payload: toJson({ error: error instanceof Error ? error.message : "unknown_error" }),
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(syncRuns.id, runId))

    throw error
  }
}
