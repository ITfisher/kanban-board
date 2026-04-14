# Architecture and Repository Conventions

This file is intended as README support material for the kanban board project. It captures the page map, data flow, core component relationships, and repository conventions without rewriting the main README.

## Page Map

| Route | Responsibility | Key UI / logic |
| --- | --- | --- |
| `/` | Client redirect entry | Sends users to `/dashboard` |
| `/dashboard` | Aggregated project analytics | Reads task/service data from `app/api/*`, computes status / priority / workload metrics |
| `/tasks` | Main kanban workflow | Task creation, filtering, drag-and-drop status changes, batch delete |
| `/tasks/[id]` | Task detail and task-branch lifecycle | Task branches, linked services, developers, and stage snapshot status |
| `/services` | Service registry | Service CRUD plus repository ownership and stage pipeline entry |
| `/services/[id]` | Service main view | Stage tabs, matrix/list view, PR state, and actionable pipeline status |
| `/repositories` | Repository registry | Repository CRUD, SCM binding, and repository-scoped overview |
| `/branches` | Service pipeline entry | Service list that routes into `/services/[id]` |
| `/settings` | App configuration | UI preferences, import/export, SCM connection management |

## Page and Layout Flow

```mermaid
flowchart TD
    A[/] --> B[/dashboard]
    B --> L[MainLayout]
    C[/tasks] --> L
    D[/tasks/[id]] --> L
    E[/services] --> L
    F[/branches] --> L
    G[/settings] --> L
    L --> S[Sidebar]
```

## Runtime Data Flow

```mermaid
flowchart LR
    Pages[App Router pages]
    UI[Business components]
    AppApi[/app/api/*]
    DB[(SQLite / data/kanban.db)]
    GitHubApi[/app/api/github/*]
    GitHub[GitHub / GitHub Enterprise]

    Pages <--> UI
    UI --> AppApi
    AppApi <--> DB
    UI --> GitHubApi
    GitHubApi --> GitHub
```

### Persistent tables

- `repositories`: root entity for services, task branches, and SCM bindings
- `services` + `service_stages`: service registry and custom stage pipelines
- `tasks` + `task_branches`: tasks and repository-scoped demand branches
- `task_branch_services` + `task_branch_developers`: branch links to services and developers
- `pull_requests`: PR history for each branch/service/stage attempt
- `service_branch_stage_snapshots`: current service main-view read model
- `scm_connections` + `repository_connections`: explicit SCM credentials and repository mappings
- `events`, `merge_operations`, `sync_runs`: audit and synchronization history
- `settings`: UI preferences singleton

## Core Component Relationships

```mermaid
flowchart TD
    Root[app/layout.tsx] --> MainLayout[components/main-layout.tsx]
    MainLayout --> Sidebar[components/sidebar.tsx]
    TasksPage[app/tasks/page.tsx] --> CreateTaskDialog[components/create-task-dialog.tsx]
    TasksPage --> SearchFilter[components/search-filter.tsx]
    TasksPage --> TaskCard[components/task-card.tsx]
    TasksPage --> ConfirmationDialog[components/confirmation-dialog.tsx]
    TaskDetail[app/tasks/[id]/page.tsx] --> TaskApi[app/api/tasks/*]
    ServicesPage[app/services/page.tsx] --> AddServiceDialog[components/add-service-dialog.tsx]
    RepositoriesPage[app/repositories/page.tsx] --> TaskApi
    BranchesPage[app/branches/page.tsx] --> TaskApi
    SettingsPage[app/settings/page.tsx] --> SettingsApi[app/api/settings/route.ts]
```

## Repository Conventions

### Runtime shape

- The app is a Next.js 15 App Router project with mostly client-rendered pages.
- `app/layout.tsx` owns global font, analytics, and toast setup.
- Business data is persisted in SQLite (`data/kanban.db`) through Drizzle ORM.
- `app/api/tasks/*`, `app/api/task-branches/*`, `app/api/services/*`, `app/api/repositories/*`, `app/api/scm-connections/*`, `app/api/settings/*`, and `app/api/users/*` are the server-side data boundary.
- GitHub integration is proxied through `app/api/github/*` route handlers.

### Directory intent

- `app/`: route entry points and server route handlers
- `components/`: business UI plus generated `components/ui/*` primitives
- `hooks/`: shared client hooks such as toast and viewport helpers
- `lib/`: database bootstrap, schema definitions, mappers, validators, and integration utilities
- `public/`: static assets

### Editing guidance

- Keep UI copy in Chinese unless a specific integration requires English.
- Prefer extending existing shadcn/ui-based patterns before introducing new primitives.
- Treat `app/api/*` as the persistence boundary for client features.
- Prefer the API routes under `app/api/github/*` over the older `lib/github-api.ts` helper when adding GitHub-related behavior.

## Code Review Notes for README / Maintainers

- `next.config.mjs` currently skips lint and type failures during production builds. This keeps builds resilient, but it also means `pnpm lint` must stay green outside the build pipeline.
- Core domain types are now largely centralized in `lib/types.ts`; future fields should be added there first to avoid drift across pages and route handlers.
- SCM connections are stored in SQLite and only exposed to the client without tokens; keep token access strictly server-side.
