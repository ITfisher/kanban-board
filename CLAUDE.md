# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chinese-language project management Kanban board (项目管理看板) built with Next.js 15 App Router, React 19, and TypeScript. The current codebase has been refactored to a repository-centric model: tasks own `task_branches`, branches attach to multiple same-repository services, services define custom stage pipelines, and GitHub state is tracked through PR history plus service-stage snapshots.

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
| `/tasks` | Main Kanban board with 5 columns (backlog→todo→in-progress→testing→done) |
| `/tasks/[id]` | Task detail showing task branches, linked services, developers, and stage snapshots |
| `/branches` | Service pipeline entry; choose a service and drill into its main view |
| `/services` | Service registry management |
| `/services/[id]` | Service main view with stage tabs and matrix/list pipeline views |
| `/repositories` | Repository registry and SCM binding management |
| `/settings` | App settings + SCM connection configuration |

### API Routes (GitHub Integration)

All routes live under `app/api/github/` and proxy calls server-side to avoid CORS and keep tokens out of the browser:

- `POST /api/github/pull-request` — Create a PR for a specific `task_branch + service + stage`, using explicit repository identity
- `GET /api/github/pr-status` — Fetch PR state, merge status, draft/mergeable state, and CI checks
- `POST /api/github/branch-diff` — Compare a branch against a specific stage target branch
- `POST /api/github/check-merge-status` — Check whether a branch has already been merged into a target branch

Supports both GitHub.com and GitHub Enterprise by routing to `https://{domain}/api/v3/...` when domain ≠ `github.com`.

### Data Model

Business data is persisted in SQLite through `app/api/*` routes. The main runtime model is:

- `repositories` — root entity for services, task branches, and SCM bindings
- `services` + `service_stages` — service registry plus custom stage pipelines
- `tasks` + `task_branches` — tasks and their repository-scoped feature branches
- `task_branch_services` — same-repository branch-to-service links
- `task_branch_developers` — developers assigned to a task branch
- `pull_requests` — PR history for each branch/service/stage attempt
- `service_branch_stage_snapshots` — current service main-view read model
- `scm_connections` + `repository_connections` — explicit SCM credentials and repository bindings
- `events`, `merge_operations`, `sync_runs` — audit and sync history

### Key Components

- `components/app-shell.tsx` — Persistent app chrome and sidebar shell
- `components/sidebar.tsx` — Main navigation for dashboard, repositories, services, branches, tasks, settings
- `components/task-card.tsx` — Kanban card with drag handles
- `components/create-task-dialog.tsx` — New task form
- `components/task-detail-dialog.tsx` — Inline task editing dialog
- `components/branch-name-generator.tsx` — UI for `lib/branch-generator.ts`
- `components/add-service-dialog.tsx` — Service creation dialog with repository selection/creation

### Branch Name Generation (`lib/branch-generator.ts`)

Auto-detects task type (feature/bugfix/hotfix/refactor/docs) from task title/description text. Converts common Chinese terms to English slugs. Pattern: `{type}/{service}-{title}-{shortId}`.

### Design Notes

- All UI text is in Chinese — maintain this when adding or editing UI strings
- Tailwind CSS v4 with OKLCH color space, cyan primary, green accents, dark mode via CSS custom properties
- Keyboard shortcuts on the Kanban board: `Ctrl+K` (search), `Ctrl+Shift+A` (select all), `Ctrl+Shift+D` (batch delete)
- Drag and drop uses the native HTML5 API (no library)
- `/branches` is currently a service pipeline entry page; the actual service main pipeline view lives at `/services/[id]`
