# Cloud Project Save/Load — Implementation Plan

## Goal
Save Content King editor projects to the cloud via muscled-team's backend so team members can open the same project file. Assets stored in B2 Backblaze, project metadata in PostgreSQL.

---

## Architecture Overview

```
Content King (Electron App)
    ↕ HTTP (Better Auth session token)
muscled-team (Next.js API)
    ↕
PostgreSQL (project metadata) + B2 Backblaze (assets + project JSON)
```

**Flow:**
- Save: Electron uploads assets to B2 via muscled-team API → saves project JSON to B2 → writes metadata row to DB
- Load: Electron fetches project metadata → downloads project JSON → downloads any missing assets from B2

---

## Phase 1: Database Migration (muscled-team)

**File:** `muscled-team/migrations/020_content_king_projects.sql`

```sql
-- Content King project metadata
CREATE TABLE ck_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES "user"(id),
    b2_project_path TEXT NOT NULL,        -- e.g. "contentking/projects/{id}/project.json"
    locked_by TEXT REFERENCES "user"(id),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content King asset registry (for deduplication)
CREATE TABLE ck_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sha256 TEXT NOT NULL UNIQUE,          -- dedup key
    filename TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('audio', 'video')),
    size_bytes BIGINT NOT NULL,
    duration_seconds FLOAT,
    b2_path TEXT NOT NULL,                -- e.g. "contentking/assets/{sha256}.webm"
    b2_file_id TEXT NOT NULL,             -- for deletion
    uploaded_by TEXT NOT NULL REFERENCES "user"(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which assets belong to which projects (many-to-many)
CREATE TABLE ck_project_assets (
    project_id UUID NOT NULL REFERENCES ck_projects(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES ck_assets(id),
    PRIMARY KEY (project_id, asset_id)
);

CREATE INDEX idx_ck_projects_owner ON ck_projects(owner_id);
CREATE INDEX idx_ck_assets_sha256 ON ck_assets(sha256);
```

---

## Phase 2: API Endpoints (muscled-team)

All endpoints under `muscled-team/src/app/api/content-king/`

### 2a. `POST /api/content-king/projects` — Save Project

**Request body (multipart or JSON):**
```json
{
  "name": "My Video Project",
  "projectData": { /* full timeline JSON */ },
  "assets": [
    { "sha256": "abc123...", "filename": "recording-001.webm", "type": "video", "size": 2400000, "durationSeconds": 12.5 }
  ]
}
```

**Logic:**
1. Auth check — get user from session
2. For each asset, check if `sha256` already exists in `ck_assets`
   - If yes → skip upload, just link to project
   - If no → return list of assets that need uploading
3. Upload project JSON to B2 at `contentking/projects/{projectId}/project.json`
4. Upsert `ck_projects` row
5. Link assets via `ck_project_assets`
6. Return `{ projectId, assetsToUpload: ["sha256_1", "sha256_2"] }`

### 2b. `POST /api/content-king/assets/upload` — Upload Asset

**Request:** multipart form data with file + metadata (sha256, filename, type, durationSeconds)

**Logic:**
1. Auth check
2. Verify sha256 matches the uploaded file
3. Upload to B2 at `contentking/assets/{sha256}.{ext}`
4. Insert into `ck_assets`
5. Return `{ assetId, b2Path }`

### 2c. `GET /api/content-king/projects` — List Projects

**Logic:**
1. Auth check
2. Query `ck_projects` where `owner_id = userId` (later: add team sharing)
3. Return list with `id, name, updatedAt, lockedBy`

### 2d. `GET /api/content-king/projects/[id]` — Load Project

**Logic:**
1. Auth check
2. Fetch project metadata from DB
3. Generate signed B2 URL for the project JSON
4. Fetch all linked assets from `ck_project_assets` + `ck_assets`
5. Generate signed B2 URLs for each asset
6. Set `locked_by` = userId, `locked_at` = now
7. Return:
```json
{
  "project": { "id": "...", "name": "...", "lockedBy": "..." },
  "projectDataUrl": "https://signed-b2-url/project.json",
  "assets": [
    { "id": "...", "sha256": "abc...", "filename": "recording-001.webm", "downloadUrl": "https://signed-b2-url/...", "size": 2400000 }
  ]
}
```

### 2e. `POST /api/content-king/projects/[id]/unlock` — Release Lock

**Logic:**
1. Auth check — only the lock holder or admin can unlock
2. Set `locked_by = NULL, locked_at = NULL`

---

## Phase 3: Project JSON Format (.ck)

The project JSON stored in B2 contains everything needed to reconstruct the editor state:

```json
{
  "version": 1,
  "name": "My Video Project",
  "savedAt": "2026-02-15T12:00:00Z",
  "savedBy": "user-id",
  "timeline": {
    "tracks": [
      { "id": "t1", "index": 0, "name": "Video 1", "type": "video", "visible": true, "locked": false, "muted": false }
    ],
    "clips": [
      {
        "id": "c1",
        "assetSha256": "abc123...",
        "trackIndex": 0,
        "startFrame": 0,
        "durationFrames": 150,
        "sourceInFrame": 0,
        "sourceOutFrame": 150
      }
    ]
  },
  "assets": {
    "abc123...": {
      "filename": "recording-001.webm",
      "type": "video",
      "size": 2400000,
      "durationSeconds": 12.5
    }
  }
}
```

**Key design choice:** Clips reference assets by `sha256` hash, NOT local file paths. This makes the project portable across machines.

---

## Phase 4: Content King Electron Integration

### 4a. Auth in Electron

Add a login screen to Content King that authenticates against muscled-team's Better Auth:

```ts
// In Electron main process or renderer
const login = async (email: string, password: string) => {
  const res = await fetch(`${MUSCLED_TEAM_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  // Store the session cookie/token for subsequent API calls
}
```

**Store session token** in Electron's `safeStorage` (encrypted keychain).

### 4b. Save Project Flow (Electron side)

1. User clicks "Save Project" (or Cmd+S)
2. Collect current editor state: clips, tracks, assets list
3. For each local asset file, compute SHA-256 hash
4. Call `POST /api/content-king/projects` with project data + asset hashes
5. API returns which assets need uploading
6. Upload missing assets via `POST /api/content-king/assets/upload`
7. Show success toast

### 4c. Load Project Flow (Electron side)

1. User clicks "Open Project" → sees list from `GET /api/content-king/projects`
2. Selects a project → calls `GET /api/content-king/projects/[id]`
3. Downloads project JSON from signed URL
4. For each asset in the project:
   - Check if already cached locally (by sha256)
   - If not, download from signed B2 URL to local cache: `~/ContentKing/cache/{sha256}.{ext}`
5. Map asset sha256s → local file paths
6. Load the timeline into the editor

### 4d. Local Asset Cache

```
~/ContentKing/cache/
  abc123def456.webm    ← cached by sha256
  789xyz000111.wav
```

- Before downloading, check if `~/ContentKing/cache/{sha256}.{ext}` exists
- Keeps assets across project loads — only download once
- Add a "Clear cache" option in settings

---

## Phase 5: Team Sharing (Later Enhancement)

Once core save/load works, extend with:

1. Add `ck_project_members` table (project_id, user_id, role: owner/editor/viewer)
2. Update list endpoint to include shared projects
3. Lock system prevents simultaneous edits
4. "Share" button that adds team members by email

---

## Implementation Order

### Increment 1 — DB + API (muscled-team) — No UI to test
1. Create migration `020_content_king_projects.sql`
2. Build `POST /api/content-king/assets/upload` endpoint
3. Build `POST /api/content-king/projects` (save) endpoint
4. Build `GET /api/content-king/projects` (list) endpoint
5. Build `GET /api/content-king/projects/[id]` (load) endpoint
6. Build `POST /api/content-king/projects/[id]/unlock` endpoint

### Increment 2 — Electron Auth (Content King) — UI: Login screen
1. Add login screen component
2. Implement Better Auth sign-in via muscled-team URL
3. Store session token securely
4. Add auth state to app (logged in / logged out)

**User tests:** Can log in, sees authenticated state

### Increment 3 — Save Flow (Content King) — UI: Save button works
1. Add SHA-256 hashing for local asset files (in Electron main process)
2. Implement asset upload to muscled-team API
3. Implement project save (serialize editor state → upload)
4. Wire up "Save Project" button in header

**User tests:** Click save → project appears in DB, assets in B2

### Increment 4 — Load Flow (Content King) — UI: Open project dialog
1. Build "Open Project" dialog showing project list
2. Implement project JSON download + parse
3. Implement asset download + local caching
4. Load timeline state into editor

**User tests:** Save a project → close → reopen → load it back, everything intact

### Increment 5 — Locking + Polish
1. Show lock status on project list ("Being edited by X")
2. Auto-lock on open, unlock on close/save
3. Auto-expire locks after 30 min
4. Error handling, retry logic, progress indicators

**User tests:** Two users, one edits while other sees lock message
