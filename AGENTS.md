# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A Chinese-language project management Kanban board (项目管理看板) built with Next.js 15 App Router, React 19, and TypeScript. Features task tracking with GitHub PR integration, multi-service branch management, and a dashboard for team analytics.

## Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

No test suite exists in this project.

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router (all pages are `"use client"`)
- **UI**: React 19, TypeScript, Tailwind CSS v4, shadcn/ui (New York variant) with Radix UI
- **Markdown**: `@uiw/react-md-editor` for task descriptions
- **State**: React hooks + `useLocalStorage` hook for all persistence (no backend database)

### Pages & Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/dashboard` |
| `/dashboard` | Analytics: task counts, completion rate, priority/status/service distribution |
| `/tasks` | Main Kanban board with 5 columns (backlog→todo→in-progress→review→done) |
| `/tasks/[id]` | Task detail with markdown editor, service branch management, and PR tracking |
| `/branches` | Git branch overview across services |
| `/services` | Service registry management |
| `/settings` | App settings + GitHub configuration |

### API Routes (GitHub Integration)

All routes live under `app/api/github/` and proxy calls server-side to avoid CORS and keep tokens out of the browser:

- `POST /api/github/pull-request` — Create a PR; selects GitHub config by `configId` or auto-matches by service repository domain
- `GET /api/github/pr-status` — Fetch PR state, merge status, and CI check results
- `POST /api/github/branch-diff` — Compare branch divergence against test/master
- `POST /api/github/check-merge-status` — Check if branch is already merged

Supports both GitHub.com and GitHub Enterprise by routing to `https://{domain}/api/v3/...` when domain ≠ `github.com`.

### Data Model

All data lives in localStorage under these keys:

| Key | Type | Description |
|-----|------|-------------|
| `kanban-tasks` | `Task[]` | All tasks |
| `kanban-services` | `Service[]` | Service registry |
| `kanban-settings` | `SettingsData` | User preferences + GitHub configs |

**Task** shape (abridged):
```ts
{
  id, title, description, status, priority,
  assignee?: { name, avatar? },
  jiraUrl?,
  serviceBranches?: ServiceBranch[],   // per-service branches for this task
  createdAt?, updatedAt?
}
```

**ServiceBranch** tracks per-branch state: `branchName`, `pullRequestUrl`, `prStatus` (open/closed/merged, CI checks), `diffStatus` (ahead/behind vs test and master), `mergedToTest`, `mergedToMaster`.

**Settings / GitHub Configs**: Multiple GitHub configs supported (`GitHubConfig[]`), each with `id`, `name`, `domain`, `owner`, `token`. One can be marked `isDefault`. The API routes receive these configs from the client on each request (configs are stored in localStorage, not on the server).

### Key Components

- `components/main-layout.tsx` — Wraps all pages with sidebar navigation
- `components/task-card.tsx` — Kanban card with drag handles
- `components/create-task-dialog.tsx` — New task form
- `components/task-detail-dialog.tsx` — Inline task editing dialog
- `components/git-branch-manager.tsx` — Manages `serviceBranches` on a task; triggers PR creation
- `components/branch-name-generator.tsx` — UI for `lib/branch-generator.ts`
- `components/service-manager.tsx` / `components/add-service-dialog.tsx` — Service CRUD

### Branch Name Generation (`lib/branch-generator.ts`)

Auto-detects task type (feature/bugfix/hotfix/refactor/docs) from task title/description text. Converts common Chinese terms to English slugs. Pattern: `{type}/{service}-{title}-{shortId}`.

### Design Notes

- All UI text is in Chinese — maintain this when adding or editing UI strings
- Tailwind CSS v4 with OKLCH color space, cyan primary, green accents, dark mode via CSS custom properties
- Keyboard shortcuts on the Kanban board: `Ctrl+K` (search), `Ctrl+Shift+A` (select all), `Ctrl+Shift+D` (batch delete)
- Drag and drop uses the native HTML5 API (no library)
- `useLocalStorage` initializes with `initialValue` on first render then hydrates from `window.localStorage` in a `useEffect` — components must handle the initial empty/default state
