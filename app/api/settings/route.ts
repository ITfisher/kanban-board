import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { settings, githubConfigs } from "@/lib/schema"

function toClientSettings(s: typeof settings.$inferSelect, configs: (typeof githubConfigs.$inferSelect)[]) {
  return {
    notifications: s.notifications === 1,
    darkMode: s.darkMode === 1,
    compactView: s.compactView === 1,
    showAssigneeAvatars: s.showAssigneeAvatars === 1,
    defaultPriority: s.defaultPriority,
    branchPrefix: s.branchPrefix,
    // Return configs WITHOUT tokens
    githubConfigs: configs.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      owner: c.owner,
      isDefault: c.isDefault === 1,
    })),
  }
}

export async function GET() {
  try {
    const rows = await db.select().from(settings).where(eq(settings.id, "singleton"))
    const configs = await db.select().from(githubConfigs)
    const row = rows[0]
    if (!row) {
      return NextResponse.json({ error: "设置不存在" }, { status: 404 })
    }
    return NextResponse.json(toClientSettings(row, configs))
  } catch (error) {
    console.error("GET /api/settings error:", error)
    return NextResponse.json({ error: "获取设置失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      notifications,
      darkMode,
      compactView,
      showAssigneeAvatars,
      defaultPriority,
      branchPrefix,
    } = body

    const updateData: Partial<typeof settings.$inferInsert> = {}
    if (notifications !== undefined) updateData.notifications = notifications ? 1 : 0
    if (darkMode !== undefined) updateData.darkMode = darkMode ? 1 : 0
    if (compactView !== undefined) updateData.compactView = compactView ? 1 : 0
    if (showAssigneeAvatars !== undefined) updateData.showAssigneeAvatars = showAssigneeAvatars ? 1 : 0
    if (defaultPriority !== undefined) updateData.defaultPriority = defaultPriority
    if (branchPrefix !== undefined) updateData.branchPrefix = branchPrefix

    await db.update(settings).set(updateData).where(eq(settings.id, "singleton"))

    const rows = await db.select().from(settings).where(eq(settings.id, "singleton"))
    const configs = await db.select().from(githubConfigs)
    return NextResponse.json(toClientSettings(rows[0], configs))
  } catch (error) {
    console.error("PUT /api/settings error:", error)
    return NextResponse.json({ error: "保存设置失败" }, { status: 500 })
  }
}
