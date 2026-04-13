import type { SettingsData } from "@/lib/types"

export const DEFAULT_SETTINGS: SettingsData = {
  notifications: true,
  darkMode: false,
  compactView: false,
  showAssigneeAvatars: true,
  defaultPriority: "medium",
  autoCreateBranch: true,
  branchPrefix: "feature/",
}
