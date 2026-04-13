import type { Config } from "drizzle-kit"

export default {
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/kanban.db",
  },
} satisfies Config
