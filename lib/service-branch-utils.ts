import type { Service, ServiceBranch } from "@/lib/types"

type ServiceIdentity = Pick<Service, "id" | "name">

export function resolveServiceFromBranch(
  services: Service[],
  branch: Pick<ServiceBranch, "serviceId">
): Service | undefined {
  if (!branch.serviceId) {
    return undefined
  }

  return services.find((service) => service.id === branch.serviceId)
}

export function requireBranchService(
  services: ServiceIdentity[],
  branch: Pick<ServiceBranch, "serviceId">
): Pick<ServiceBranch, "serviceId" | "serviceName"> {
  if (!branch.serviceId) {
    throw new Error("服务分支缺少 serviceId")
  }

  const matchedService = services.find((service) => service.id === branch.serviceId)
  if (!matchedService) {
    throw new Error(`找不到 serviceId 为 ${branch.serviceId} 的服务`)
  }

  return {
    serviceId: matchedService.id,
    serviceName: matchedService.name,
  }
}

export function isBranchLinkedToService(
  branch: Pick<ServiceBranch, "serviceId">,
  service: Pick<Service, "id">
) {
  return branch.serviceId === service.id
}
