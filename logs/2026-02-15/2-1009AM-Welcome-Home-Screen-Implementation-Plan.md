# Welcome / Home Screen Implementation Plan

## Overview
Replace the small "Open Project" modal with a full-screen Welcome/Home screen (like Premiere Pro, Figma, VS Code). This is the first thing users see on launch. Once they open or create a project, it transitions to the editor. They can return to the Home screen via a button in the editor header.

## Architecture

### App Flow
```
App Launch → Auth Check → Home Screen → (Open/Create) → Video Editor
                                ↑                              |
                                └──── "Home" button ───────────┘
```

### State in App.tsx
```
user: null       → LoginScreen
user: set, no project → HomeScreen
user: set, project loaded → VideoStudio
```

## Files to Modify/Create

### 1. Create `src/components/HomeScreen.tsx` (NEW)
Full-screen welcome page with:
- **Header bar**: App logo/name on left, user name + logout button on right
- **Main content area** (centered, max-width ~800px):
  - **"New Project"** button — prominent, creates a blank project and opens editor
  - **Recent Projects list** — cards/rows showing:
    - Project name
    - Last edited date (relative: "2 hours ago", "Yesterday", etc.)
    - Lock status (if locked by someone else)
    - **Open** button
    - **Delete** button (with confirmation)
  - **Empty state**: "No projects yet. Create your first project!" when list is empty
  - **Loading state**: Skeleton/spinner while fetching
  - **Error state**: Retry button

### 2. Create `DELETE /api/content-king/projects/[id]` endpoint (muscled-team)
- New route: `src/app/api/content-king/projects/[id]/route.ts` — add DELETE handler
- New action: `deleteCkProject` in `ck-project-actions.ts`
  - Verify ownership (only owner can delete)
  - Delete from `ck_project_asset` (junction table)
  - Delete from `ck_project`
  - Optionally: delete project JSON from B2 (or leave for cleanup later)
  - Do NOT delete assets from `ck_asset` — they may be shared across projects

### 3. Modify `src/lib/useProjectLoad.ts`
- Add `deleteProject(projectId: string)` function
  - Calls `DELETE /api/content-king/projects/${projectId}`
  - Removes from local `projects` state
  - Returns success/error

### 4. Modify `src/App.tsx`
- Add `activeProject` state: `{ id: string; name: string } | null`
- When `activeProject` is null → show `HomeScreen`
- When `activeProject` is set → show `VideoStudio`
- Pass `onGoHome` callback to VideoStudio (clears activeProject, unlocks project)
- Pass `onOpenProject` and `onNewProject` to HomeScreen

### 5. Modify `src/components/video-studio/VideoStudio.tsx`
- Remove the `OpenProjectDialog` usage (moved to HomeScreen)
- Remove the "Open" button from header
- Add "Home" button in header (house icon) that calls `onGoHome`
- Keep Save button (saves to current project)
- Add `projectId` and `projectName` props

### 6. Remove `src/components/OpenProjectDialog.tsx`
- No longer needed — HomeScreen replaces it

## Incremental Phases

### Phase 1: Delete endpoint + HomeScreen UI
**UI to test**: Full home screen with project list, new project button, delete button
- Create DELETE endpoint in muscled-team
- Create `deleteCkProject` action
- Add `deleteProject` to `useProjectLoad`
- Build `HomeScreen.tsx` component
- Wire into `App.tsx` with activeProject state

### Phase 2: Wire editor transitions
**UI to test**: Full flow — Home → Editor → Home
- Open project from HomeScreen → loads into editor
- New project from HomeScreen → blank editor
- Home button in editor → back to HomeScreen (with unlock)
- Remove OpenProjectDialog and Open button from editor header

### Phase 3: Polish
**UI to test**: Delete confirmation, relative dates, empty states
- Delete confirmation dialog ("Are you sure? This cannot be undone.")
- Relative date formatting ("2 hours ago", "Yesterday")
- Project name editing (rename from HomeScreen or editor)
- Auto-refresh project list when returning to HomeScreen

## Design Notes
- Dark theme consistent with editor (bg-gray-950 or bg-gray-900)
- Project cards: bg-gray-800 with hover state, border-gray-700
- Delete button: red, only visible on hover or as icon
- New Project button: blue/primary, prominent
- Keep it clean and minimal — no unnecessary decoration
