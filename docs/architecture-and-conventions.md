# Architecture and Repository Conventions

This file is intended as README support material for the kanban board project. It captures the page map, data flow, core component relationships, and repository conventions without rewriting the main README.

## Page Map

| Route | Responsibility | Key UI / logic |
| --- | --- | --- |
| `/` | Client redirect entry | Sends users to `/dashboard` |
| `/dashboard` | Aggregated project analytics | Reads `kanban-tasks` and `kanban-services`, computes status / priority / workload metrics |
| `/tasks` | Main kanban workflow | Task creation, filtering, drag-and-drop status changes, batch delete |
| `/tasks/[id]` | Task detail and branch lifecycle | Markdown editing, service branch tracking, PR / merge status polling |
| `/services` | Service registry | Service CRUD plus branch defaults and repository metadata |
| `/branches` | Branch rollout view | Cross-task service branch summary and deploy-to-test / deploy-to-prod PR actions |
| `/settings` | Local app configuration | UI preferences, import/export, GitHub config management |

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

## Client Data Flow

```mermaid
flowchart LR
    LS[(localStorage)]
    Pages[App Router pages]
    Hooks[useLocalStorage hook]
    UI[Business components]
    API[/app/api/github/*]
    GitHub[GitHub / GitHub Enterprise]

    LS <--> Hooks
    Hooks <--> Pages
    Pages <--> UI
    UI --> API
    API --> GitHub
```

### Persistent keys

- `kanban-tasks`: task records and per-task service branch state
- `kanban-services`: service registry, repositories, and branch defaults
- `kanban-settings`: UI preferences and GitHub config list

## Core Component Relationships

```mermaid
flowchart TD
    Root[app/layout.tsx] --> MainLayout[components/main-layout.tsx]
    MainLayout --> Sidebar[components/sidebar.tsx]
    TasksPage[app/tasks/page.tsx] --> CreateTaskDialog[components/create-task-dialog.tsx]
    TasksPage --> SearchFilter[components/search-filter.tsx]
    TasksPage --> TaskCard[components/task-card.tsx]
    TasksPage --> ConfirmationDialog[components/confirmation-dialog.tsx]
    TaskDetail[app/tasks/[id]/page.tsx] --> BranchManager[components/git-branch-manager.tsx]
    ServicesPage[app/services/page.tsx] --> ServiceManager[components/service-manager.tsx]
    ServiceManager --> AddServiceDialog[components/add-service-dialog.tsx]
```

## Repository Conventions

### Runtime shape

- The app is a Next.js 15 App Router project with mostly client-rendered pages.
- `app/layout.tsx` owns global font, analytics, and toast setup.
- Business state is browser-local; there is no server database layer.
- GitHub integration is proxied through `app/api/github/*` route handlers.

### Directory intent

- `app/`: route entry points and server route handlers
- `components/`: business UI plus generated `components/ui/*` primitives
- `hooks/`: shared client hooks such as local storage and toast helpers
- `lib/`: pure helpers and integration utilities
- `public/`: static assets

### Editing guidance

- Keep UI copy in Chinese unless a specific integration requires English.
- Prefer extending existing shadcn/ui-based patterns before introducing new primitives.
- Treat `useLocalStorage` as the main persistence boundary for client features.
- Prefer the API routes under `app/api/github/*` over the older `lib/github-api.ts` helper when adding GitHub-related behavior.

## Code Review Notes for README / Maintainers

- `next.config.mjs` currently skips lint and type failures during production builds. This keeps builds resilient, but it also means `pnpm lint` must stay green outside the build pipeline.
- Core domain types such as `Task`, `Service`, and `GitHubConfig` are duplicated across several pages and route handlers. A shared typed model module would reduce drift if the app keeps growing.
- GitHub configs are stored in `localStorage`; this is convenient for local-only usage but should be called out as a trust-boundary decision if the product ever moves beyond personal/internal usage.
