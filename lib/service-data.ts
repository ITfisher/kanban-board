import { services } from "@/lib/schema"
import type { Service } from "@/lib/types"

type ServiceRow = typeof services.$inferSelect

export function toClientService(service: ServiceRow): Service {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    repository: service.repository,
    testBranch: service.testBranch,
    masterBranch: service.masterBranch,
    dependencies: JSON.parse(service.dependencies) as string[],
  }
}
