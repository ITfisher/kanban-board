# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern Kanban board application built with Next.js 15, React 19, and TypeScript. The application features a Chinese interface (项目管理看板) and provides project management capabilities with drag-and-drop task management, filtering, and service organization.

## Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production  
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint (configured to ignore during builds)

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **UI**: React 19, TypeScript, Tailwind CSS v4
- **Components**: shadcn/ui components with Radix UI primitives
- **Icons**: Lucide React
- **State Management**: React hooks with localStorage persistence via custom `useLocalStorage` hook
- **Styling**: Tailwind CSS with custom design tokens using OKLCH color space

### Key Design Patterns

**Component Structure**:
- `app/` - Next.js App Router pages and API routes
- `components/` - Reusable UI components (shadcn/ui based)
- `components/ui/` - Base UI components
- `hooks/` - Custom React hooks
- `lib/` - Utility functions

**Data Management**:
- Tasks and services are persisted to localStorage using the `useLocalStorage` hook
- All data is managed locally - no backend integration
- Task interface includes: id, title, description, status, priority, assignee, gitBranch, service, labels

**UI Architecture**:
- Uses shadcn/ui component library (New York style variant)
- Path aliases configured: `@/*` maps to project root
- Custom design system with cyan primary color and green accents
- Dark mode support via CSS custom properties

### Key Components

**Main Layout**: `components/main-layout.tsx` - Provides sidebar and main content layout
**Task Management**: `app/page.tsx` - Main kanban board with 5 status columns (backlog, todo, in-progress, review, done)
**Drag & Drop**: Implemented natively with HTML5 drag and drop API
**Keyboard Shortcuts**: Ctrl+K (search), Ctrl+Shift+A (select all), Ctrl+Shift+D (batch delete)

### Configuration

**Next.js**: ESLint and TypeScript errors ignored during builds for faster development
**Tailwind**: Uses v4 with PostCSS, includes custom color tokens and design system
**TypeScript**: Strict mode enabled with path mapping for clean imports

## Development Notes

- Application is in Chinese language - maintain Chinese text in UI
- Uses modern React patterns (hooks, functional components)
- No backend - all data persisted via localStorage
- Drag and drop functionality is core to the user experience
- Keyboard shortcuts and bulk operations are important UX features