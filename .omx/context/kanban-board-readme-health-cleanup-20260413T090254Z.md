## Task Statement

Use OMX team workflow to improve the project README with a clear architecture/flow diagram and perform a code-health cleanup that fixes current lint issues, removes clearly unused dependencies, and tightens project code conventions/structure with minimal behavioral change.

## Desired Outcome

- README explains project purpose, routes, data flow, core components, localStorage model, and GitHub integration.
- README includes a concise structure diagram that helps a new maintainer understand the app quickly.
- `pnpm lint` passes.
- Clearly unused dependencies are removed without breaking the app.
- Project conventions and structure are documented in a lightweight, repo-appropriate way.
- Changes stay small, reversible, and behavior-preserving.

## Known Facts / Evidence

- Tech stack: Next.js 15, React 19, TypeScript, Tailwind v4, shadcn/ui.
- Data persistence is local-first via `localStorage` through `hooks/use-local-storage.ts`.
- Main routes:
  - `/dashboard`
  - `/tasks`
  - `/tasks/[id]`
  - `/services`
  - `/branches`
  - `/settings`
- GitHub API proxy routes:
  - `app/api/github/pull-request/route.ts`
  - `app/api/github/pr-status/route.ts`
  - `app/api/github/branch-diff/route.ts`
  - `app/api/github/check-merge-status/route.ts`
- `pnpm build` passes because `next.config.mjs` ignores lint and TypeScript build errors.
- `pnpm lint` currently fails with:
  - `no-explicit-any` in API routes
  - hook dependency warnings
  - unused variable warnings
- `package.json` contains clearly unused cross-framework deps with no repo references:
  - `@remix-run/react`
  - `@sveltejs/kit`
  - `svelte`
  - `vue`
  - `vue-router`

## Constraints

- No new dependencies unless explicitly requested.
- Prefer deletion over addition.
- Keep diffs small and reviewable.
- Do not revert unrelated user changes in the dirty worktree.
- Cleanup/refactor work requires a written plan before modifications.
- No test suite exists; avoid broad behavior-changing refactors.

## Unknowns / Open Questions

- Whether `omx team` can be launched directly from this non-tmux leader shell or must be started inside a detached tmux session.
- Whether any generated shadcn/ui components rely on dependencies that appear unused from app entrypoints.
- How far to go on "规范项目结构" without crossing into large-scale refactor territory.

## Likely Codebase Touchpoints

- `README.md`
- `package.json`
- `next.config.mjs`
- `app/dashboard/page.tsx`
- `app/tasks/page.tsx`
- `app/tasks/[id]/page.tsx`
- `app/branches/page.tsx`
- `app/settings/page.tsx`
- `app/api/github/branch-diff/route.ts`
- `app/api/github/check-merge-status/route.ts`
- `components/add-service-dialog.tsx`
- `components/branch-name-generator.tsx`
- `components/task-card.tsx`
- `components/ui/use-toast.ts`

## Cleanup Plan

1. Document the current architecture and user flows before code edits.
2. Fix lint errors first, then resolve warnings where the intent is clear and low-risk.
3. Remove only dependencies with strong evidence of being unused.
4. Add lightweight repository conventions documentation instead of large codebase reshuffling.
5. Re-run lint and build after changes and summarize any remaining risks.

## Team Staffing

- Worker 1: README + architecture/data-flow diagram + conventions documentation.
- Worker 2: lint fixes in app/routes/components without behavior changes.
- Worker 3: dependency audit, verification, and final health-check evidence.
