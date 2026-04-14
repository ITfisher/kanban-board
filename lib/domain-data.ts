import { db } from "@/lib/db"
import {
  pullRequests,
  repositories,
  serviceBranchStageSnapshots,
  serviceStages,
  services,
  taskAssignments,
  taskBranchDevelopers,
  taskBranchServices,
  taskBranches,
  tasks,
  users,
} from "@/lib/schema"
import { normalizeTaskStatus } from "@/lib/task-status"
import type {
  PullRequestRecord,
  Repository,
  Service,
  ServiceBranchStageSnapshot,
  ServiceStage,
  Task,
  TaskBranch,
  User,
} from "@/lib/types"

type RepositoryRow = typeof repositories.$inferSelect
type ServiceRow = typeof services.$inferSelect
type ServiceStageRow = typeof serviceStages.$inferSelect
type TaskRow = typeof tasks.$inferSelect
type TaskBranchRow = typeof taskBranches.$inferSelect
type TaskBranchServiceRow = typeof taskBranchServices.$inferSelect
type TaskBranchDeveloperRow = typeof taskBranchDevelopers.$inferSelect
type TaskAssignmentRow = typeof taskAssignments.$inferSelect
type PullRequestRow = typeof pullRequests.$inferSelect
type SnapshotRow = typeof serviceBranchStageSnapshots.$inferSelect
type UserRow = typeof users.$inferSelect

export type ServicePayload = Service & {
  repositoryEntity?: RepositoryPayload
  stages: ServiceStage[]
  taskBranchCount: number
  snapshotCount: number
}

export type TaskBranchPayload = TaskBranch & {
  branchName: string
  repository?: RepositoryPayload
  task?: Pick<Task, "id" | "title" | "status" | "priority">
  services: ServicePayload[]
  developers: User[]
  pullRequests: PullRequestRecord[]
  snapshots: ServiceBranchStageSnapshot[]
}

export type TaskPayload = Task & {
  taskBranches: TaskBranchPayload[]
}

export type RepositoryPayload = Repository & {
  fullName: string
  serviceCount: number
  taskBranchCount: number
}

export type StageBoardItem = {
  taskId: string
  taskTitle: string
  taskStatus: Task["status"]
  taskPriority: Task["priority"]
  taskBranchId: string
  branchName: string
  repositoryId: string
  repositoryName?: string
  developers: User[]
  stageSnapshot: ServiceBranchStageSnapshot
  latestPullRequest?: PullRequestRecord
}

export type StageBoardStage = {
  stage: ServiceStage
  unmerged: StageBoardItem[]
  merged: StageBoardItem[]
}

type DomainRows = {
  repositoryRows: RepositoryRow[]
  serviceRows: ServiceRow[]
  stageRows: ServiceStageRow[]
  taskRows: TaskRow[]
  taskBranchRows: TaskBranchRow[]
  taskBranchServiceRows: TaskBranchServiceRow[]
  taskBranchDeveloperRows: TaskBranchDeveloperRow[]
  taskAssignmentRows: TaskAssignmentRow[]
  userRows: UserRow[]
  pullRequestRows: PullRequestRow[]
  snapshotRows: SnapshotRow[]
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function parseJsonObject<T>(value: string | null | undefined): T | undefined {
  if (!value) {
    return undefined
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

function parseMergeable(value: number | null): boolean | null | undefined {
  if (value === null || value === undefined) {
    return value as null | undefined
  }

  return value === 1
}

function toClientRepository(row: RepositoryRow): RepositoryPayload {
  const repoName = row.slug || row.name

  return {
    id: row.id,
    name: row.name,
    provider: row.provider as Repository["provider"],
    domain: row.domain,
    owner: row.owner,
    slug: repoName,
    defaultBranch: row.defaultBranch,
    description: row.description || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt || undefined,
    fullName: `${row.owner}/${repoName}`,
    serviceCount: 0,
    taskBranchCount: 0,
  }
}

function toClientStage(row: ServiceStageRow): ServiceStage {
  return {
    id: row.id,
    serviceId: row.serviceId,
    name: row.name,
    key: row.key,
    description: row.description || undefined,
    position: row.position,
    targetBranch: row.targetBranch,
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toClientUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email || undefined,
    avatarUrl: row.avatarUrl || undefined,
    source: row.source || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toClientPullRequest(row: PullRequestRow): PullRequestRecord {
  return {
    id: row.id,
    repositoryId: row.repositoryId,
    taskBranchId: row.taskBranchId,
    serviceId: row.serviceId,
    serviceStageId: row.serviceStageId,
    provider: row.provider as PullRequestRecord["provider"],
    providerDomain: row.providerDomain,
    externalNumber: row.externalNumber ?? undefined,
    title: row.title,
    htmlUrl: row.htmlUrl || undefined,
    sourceBranch: row.sourceBranch,
    targetBranch: row.targetBranch,
    state: row.state as PullRequestRecord["state"],
    merged: row.merged === 1,
    mergeable: parseMergeable(row.mergeable),
    mergeableState: row.mergeableState || undefined,
    headSha: row.headSha || undefined,
    baseSha: row.baseSha || undefined,
    draft: row.draft === 1,
    authorUserId: row.authorUserId || undefined,
    rawPayload: row.rawPayload || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt || undefined,
    mergedAt: row.mergedAt || undefined,
    lastSyncedAt: row.lastSyncedAt || undefined,
  }
}

function toClientSnapshot(row: SnapshotRow): ServiceBranchStageSnapshot {
  return {
    id: row.id,
    repositoryId: row.repositoryId,
    serviceId: row.serviceId,
    taskId: row.taskId,
    taskBranchId: row.taskBranchId,
    serviceStageId: row.serviceStageId,
    stageStatus: row.stageStatus as ServiceBranchStageSnapshot["stageStatus"],
    gateStatus: row.gateStatus as ServiceBranchStageSnapshot["gateStatus"],
    isActionable: row.isActionable === 1,
    actionType: row.actionType as ServiceBranchStageSnapshot["actionType"],
    latestPullRequestId: row.latestPullRequestId || undefined,
    latestPullRequestNumber: row.latestPullRequestNumber ?? undefined,
    latestPullRequestState: row.latestPullRequestState as ServiceBranchStageSnapshot["latestPullRequestState"],
    latestPullRequestUrl: row.latestPullRequestUrl || undefined,
    latestPullRequestTitle: row.latestPullRequestTitle || undefined,
    latestPullRequestMergeable:
      row.latestPullRequestMergeable === null || row.latestPullRequestMergeable === undefined
        ? undefined
        : row.latestPullRequestMergeable === 1,
    latestPullRequestMergeableState: row.latestPullRequestMergeableState || undefined,
    latestPullRequestDraft: row.latestPullRequestDraft === 1,
    latestPullRequestChecks: parseJsonObject<ServiceBranchStageSnapshot["latestPullRequestChecks"]>(row.latestPullRequestChecks),
    taskTitle: row.taskTitle,
    taskStatus: normalizeTaskStatus(row.taskStatus),
    branchName: row.branchName,
    developerUserIds: parseStringArray(row.developerUserIds),
    developerNames: parseStringArray(row.developerNames),
    lastSyncedAt: row.lastSyncedAt || undefined,
    updatedAt: row.updatedAt,
  }
}

function sortStages(rows: ServiceStageRow[]): ServiceStageRow[] {
  return [...rows].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position
    }

    return left.name.localeCompare(right.name, "zh-CN")
  })
}

function getRepositoryLabel(repository?: RepositoryRow): string {
  if (!repository) {
    return ""
  }

  const repoName = repository.slug || repository.name
  return `${repository.domain}/${repository.owner}/${repoName}`
}

async function readDomainRows(): Promise<DomainRows> {
  const [
    repositoryRows,
    serviceRows,
    stageRows,
    taskRows,
    taskBranchRows,
    taskBranchServiceRows,
    taskBranchDeveloperRows,
    taskAssignmentRows,
    userRows,
    pullRequestRows,
    snapshotRows,
  ] = await Promise.all([
    db.select().from(repositories),
    db.select().from(services),
    db.select().from(serviceStages),
    db.select().from(tasks),
    db.select().from(taskBranches),
    db.select().from(taskBranchServices),
    db.select().from(taskBranchDevelopers),
    db.select().from(taskAssignments),
    db.select().from(users),
    db.select().from(pullRequests),
    db.select().from(serviceBranchStageSnapshots),
  ])

  return {
    repositoryRows,
    serviceRows,
    stageRows,
    taskRows,
    taskBranchRows,
    taskBranchServiceRows,
    taskBranchDeveloperRows,
    taskAssignmentRows,
    userRows,
    pullRequestRows,
    snapshotRows,
  }
}

function mapServiceRows(
  serviceRows: ServiceRow[],
  repositoryRows: RepositoryRow[],
  stageRows: ServiceStageRow[],
  taskBranchServiceRows: TaskBranchServiceRow[],
  snapshotRows: SnapshotRow[]
): ServicePayload[] {
  const repositoryMap = new Map(repositoryRows.map((row) => [row.id, row]))
  const stageMap = new Map<string, ServiceStage[]>()

  for (const stageRow of sortStages(stageRows)) {
    const current = stageMap.get(stageRow.serviceId) ?? []
    current.push(toClientStage(stageRow))
    stageMap.set(stageRow.serviceId, current)
  }

  return serviceRows
    .map((serviceRow) => {
      const repository = serviceRow.repositoryId ? repositoryMap.get(serviceRow.repositoryId) : undefined
      const mappedStages = stageMap.get(serviceRow.id) ?? []

      return {
        id: serviceRow.id,
        repositoryId: serviceRow.repositoryId || undefined,
        name: serviceRow.name,
        description: serviceRow.description,
        rootPath: serviceRow.rootPath || undefined,
        repository: repository ? getRepositoryLabel(repository) : undefined,
        dependencies: parseStringArray(serviceRow.dependencies),
        isActive: serviceRow.isActive === 1,
        stages: mappedStages,
        createdAt: serviceRow.createdAt || undefined,
        updatedAt: serviceRow.updatedAt || undefined,
        repositoryEntity: repository ? toClientRepository(repository) : undefined,
        taskBranchCount: taskBranchServiceRows.filter((row) => row.serviceId === serviceRow.id).length,
        snapshotCount: snapshotRows.filter((row) => row.serviceId === serviceRow.id).length,
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
}

export async function listServicePayloads(serviceId?: string): Promise<ServicePayload[]> {
  const rows = await readDomainRows()
  const servicesToMap = serviceId
    ? rows.serviceRows.filter((row) => row.id === serviceId)
    : rows.serviceRows

  return mapServiceRows(
    servicesToMap,
    rows.repositoryRows,
    rows.stageRows,
    rows.taskBranchServiceRows,
    rows.snapshotRows
  )
}

export async function getServicePayload(serviceId: string): Promise<ServicePayload | null> {
  const payloads = await listServicePayloads(serviceId)
  return payloads[0] ?? null
}

export async function listRepositoryPayloads(repositoryId?: string): Promise<RepositoryPayload[]> {
  const rows = await readDomainRows()
  const repositoriesToMap = repositoryId
    ? rows.repositoryRows.filter((row) => row.id === repositoryId)
    : rows.repositoryRows

  return repositoriesToMap
    .map((repositoryRow) => ({
      ...toClientRepository(repositoryRow),
      serviceCount: rows.serviceRows.filter((row) => row.repositoryId === repositoryRow.id).length,
      taskBranchCount: rows.taskBranchRows.filter((row) => row.repositoryId === repositoryRow.id).length,
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName, "zh-CN"))
}

export async function getRepositoryPayload(repositoryId: string): Promise<RepositoryPayload | null> {
  const payloads = await listRepositoryPayloads(repositoryId)
  return payloads[0] ?? null
}

export async function listTaskBranchPayloads(filters?: {
  taskId?: string
  taskBranchId?: string
  serviceId?: string
}): Promise<TaskBranchPayload[]> {
  const rows = await readDomainRows()
  const repositoryMap = new Map(rows.repositoryRows.map((row) => [row.id, row]))
  const taskMap = new Map(rows.taskRows.map((row) => [row.id, row]))
  const userMap = new Map(rows.userRows.map((row) => [row.id, row]))
  const servicesPayload = mapServiceRows(
    rows.serviceRows,
    rows.repositoryRows,
    rows.stageRows,
    rows.taskBranchServiceRows,
    rows.snapshotRows
  )
  const serviceMap = new Map(servicesPayload.map((service) => [service.id, service]))

  let filteredTaskBranchRows = rows.taskBranchRows

  if (filters?.taskId) {
    filteredTaskBranchRows = filteredTaskBranchRows.filter((row) => row.taskId === filters.taskId)
  }

  if (filters?.taskBranchId) {
    filteredTaskBranchRows = filteredTaskBranchRows.filter((row) => row.id === filters.taskBranchId)
  }

  if (filters?.serviceId) {
    const branchIds = new Set(
      rows.taskBranchServiceRows.filter((row) => row.serviceId === filters.serviceId).map((row) => row.taskBranchId)
    )
    filteredTaskBranchRows = filteredTaskBranchRows.filter((row) => branchIds.has(row.id))
  }

  return filteredTaskBranchRows
    .map((branchRow) => {
      const taskRow = taskMap.get(branchRow.taskId)
      const repositoryRow = repositoryMap.get(branchRow.repositoryId)
      const branchServiceRows = rows.taskBranchServiceRows.filter((row) => row.taskBranchId === branchRow.id)
      const developerRows = rows.taskBranchDeveloperRows.filter((row) => row.taskBranchId === branchRow.id)
      const pullRequestRecords = rows.pullRequestRows
        .filter((row) => row.taskBranchId === branchRow.id)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(toClientPullRequest)
      const snapshots = rows.snapshotRows
        .filter((row) => row.taskBranchId === branchRow.id)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(toClientSnapshot)
      const developers = developerRows
        .map((row) => userMap.get(row.userId))
        .filter((row): row is UserRow => Boolean(row))
        .map(toClientUser)
      const branchServices = branchServiceRows
        .map((row) => serviceMap.get(row.serviceId))
        .filter((row): row is ServicePayload => Boolean(row))

      return {
        id: branchRow.id,
        taskId: branchRow.taskId,
        repositoryId: branchRow.repositoryId,
        name: branchRow.name,
        branchName: branchRow.name,
        title: branchRow.title || undefined,
        description: branchRow.description || undefined,
        status: branchRow.status as TaskBranch["status"],
        createdByUserId: branchRow.createdByUserId || undefined,
        createdAt: branchRow.createdAt,
        updatedAt: branchRow.updatedAt,
        closedAt: branchRow.closedAt || undefined,
        lastSyncedAt: branchRow.lastSyncedAt || undefined,
        repository: repositoryRow ? toClientRepository(repositoryRow) : undefined,
        task: taskRow
          ? {
              id: taskRow.id,
              title: taskRow.title,
              status: normalizeTaskStatus(taskRow.status),
              priority: taskRow.priority as Task["priority"],
            }
          : undefined,
        services: branchServices,
        developers,
        pullRequests: pullRequestRecords,
        snapshots,
      }
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getTaskBranchPayload(taskBranchId: string): Promise<TaskBranchPayload | null> {
  const payloads = await listTaskBranchPayloads({ taskBranchId })
  return payloads[0] ?? null
}

export async function listTaskPayloads(taskId?: string): Promise<TaskPayload[]> {
  const rows = await readDomainRows()
  const tasksToMap = taskId ? rows.taskRows.filter((row) => row.id === taskId) : rows.taskRows
  const taskBranchesPayload = await listTaskBranchPayloads(taskId ? { taskId } : undefined)
  const taskBranchMap = new Map<string, TaskBranchPayload[]>()
  const userMap = new Map(rows.userRows.map((row) => [row.id, row]))
  const taskOwnerAssignmentMap = new Map<string, TaskAssignmentRow>()

  for (const taskBranch of taskBranchesPayload) {
    const current = taskBranchMap.get(taskBranch.taskId) ?? []
    current.push(taskBranch)
    taskBranchMap.set(taskBranch.taskId, current)
  }

  for (const assignmentRow of rows.taskAssignmentRows) {
    if (assignmentRow.role === "owner" && !taskOwnerAssignmentMap.has(assignmentRow.taskId)) {
      taskOwnerAssignmentMap.set(assignmentRow.taskId, assignmentRow)
    }
  }

  return tasksToMap
    .map((taskRow) => {
      const taskBranches = taskBranchMap.get(taskRow.id) ?? []
      const ownerAssignment = taskOwnerAssignmentMap.get(taskRow.id)
      const ownerUserId = taskRow.ownerUserId || ownerAssignment?.userId || undefined
      const ownerUser = ownerUserId ? userMap.get(ownerUserId) : undefined

      return {
        id: taskRow.id,
        title: taskRow.title,
        description: taskRow.description,
        status: normalizeTaskStatus(taskRow.status),
        priority: taskRow.priority as Task["priority"],
        ownerUserId,
        assignee: ownerUser
          ? {
              name: ownerUser.name,
              avatar: ownerUser.avatarUrl || undefined,
            }
          : taskRow.assigneeName
          ? {
              name: taskRow.assigneeName,
              avatar: taskRow.assigneeAvatar || undefined,
            }
          : undefined,
        jiraUrl: taskRow.jiraUrl || undefined,
        createdAt: taskRow.createdAt,
        updatedAt: taskRow.updatedAt,
        completedAt: taskRow.completedAt || undefined,
        taskBranches,
      }
    })
    .sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""))
}

export async function getTaskPayload(taskId: string): Promise<TaskPayload | null> {
  const payloads = await listTaskPayloads(taskId)
  return payloads[0] ?? null
}

function buildDefaultSnapshot(branch: TaskBranchPayload, service: ServicePayload, stage: ServiceStage): ServiceBranchStageSnapshot {
  return {
    id: `${service.id}:${branch.id}:${stage.id}`,
    repositoryId: branch.repositoryId,
    serviceId: service.id,
    taskId: branch.taskId,
    taskBranchId: branch.id,
    serviceStageId: stage.id,
    stageStatus: "idle",
    gateStatus: "unknown",
    isActionable: false,
    actionType: "noop",
    latestPullRequestId: undefined,
    latestPullRequestNumber: undefined,
    latestPullRequestState: undefined,
    latestPullRequestUrl: undefined,
    taskTitle: branch.task?.title ?? "",
    taskStatus: branch.task?.status ?? "backlog",
    branchName: branch.name,
    developerUserIds: branch.developers.map((developer) => developer.id),
    developerNames: branch.developers.map((developer) => developer.name),
    lastSyncedAt: branch.lastSyncedAt,
    updatedAt: branch.updatedAt,
  }
}

function sortStageBoardItems(items: StageBoardItem[]): StageBoardItem[] {
  return [...items].sort((left, right) => {
    if (left.stageSnapshot.isActionable !== right.stageSnapshot.isActionable) {
      return left.stageSnapshot.isActionable ? -1 : 1
    }

    return (right.stageSnapshot.updatedAt || "").localeCompare(left.stageSnapshot.updatedAt || "")
  })
}

export async function getServiceStageBoard(serviceId: string): Promise<{
  service: ServicePayload
  stages: ServiceStage[]
  board: StageBoardStage[]
} | null> {
  const service = await getServicePayload(serviceId)
  if (!service) {
    return null
  }

  const taskBranchesPayload = await listTaskBranchPayloads({ serviceId })
  const stages = service.stages.filter((stage) => stage.isActive)
  const board = stages.map((stage) => {
    const items = taskBranchesPayload.map((taskBranch) => {
      const snapshot =
        taskBranch.snapshots.find((item) => item.serviceId === serviceId && item.serviceStageId === stage.id) ??
        buildDefaultSnapshot(taskBranch, service, stage)
      const latestPullRequest = taskBranch.pullRequests.find(
        (record) => record.serviceId === serviceId && record.serviceStageId === stage.id
      )

      return {
        taskId: taskBranch.taskId,
        taskTitle: taskBranch.task?.title ?? snapshot.taskTitle,
        taskStatus: taskBranch.task?.status ?? snapshot.taskStatus,
        taskPriority: taskBranch.task?.priority ?? "medium",
        taskBranchId: taskBranch.id,
        branchName: taskBranch.name,
        repositoryId: taskBranch.repositoryId,
        repositoryName: taskBranch.repository?.fullName,
        developers: taskBranch.developers,
        stageSnapshot: snapshot,
        latestPullRequest,
      }
    })

    const merged = sortStageBoardItems(
      items.filter(
        (item) =>
          item.stageSnapshot.stageStatus === "merged" ||
          item.stageSnapshot.gateStatus === "merged" ||
          item.latestPullRequest?.merged
      )
    )
    const unmerged = sortStageBoardItems(
      items.filter(
        (item) =>
          item.stageSnapshot.stageStatus !== "merged" &&
          item.stageSnapshot.gateStatus !== "merged" &&
          !item.latestPullRequest?.merged
      )
    )

    return {
      stage,
      unmerged,
      merged,
    }
  })

  return {
    service,
    stages,
    board,
  }
}
