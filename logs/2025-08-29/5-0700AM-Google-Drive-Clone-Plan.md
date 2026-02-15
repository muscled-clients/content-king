# Google Drive Clone - Build Plan
## Date: 2025-08-29 | Time: 07:00 AM EST
## Purpose: Simple file manager for organizing media assets

---

## PROJECT OVERVIEW

Build a web-based file manager similar to Google Drive for uploading, organizing, and previewing media files (photos/videos) before they get stored in Backblaze B2.

---

## CORE FEATURES

### File Management
- Upload files and folders via drag-and-drop
- Create new folders at any level
- Move files between folders
- Rename files and folders inline
- Delete with trash recovery (30 days)
- Multi-select operations
- Copy/cut/paste functionality

### File Preview
- Photo viewer with zoom controls
- Video player with playback controls
- RAW file preview (auto-generated JPEGs)
- Thumbnail generation for grid view
- Quick preview on spacebar
- Full-screen preview mode

### Navigation
- Folder tree in sidebar
- Breadcrumb navigation
- Recent files section
- Starred/favorites system
- Search by filename
- Sort by name, date, size, type
- Grid and list view toggle

---

## USER INTERFACE

### Layout Structure
- Left sidebar with folder tree
- Main content area with files/folders
- Top toolbar with actions
- Right-click context menus
- Drag-and-drop visual feedback
- Progress indicators for uploads

### Key Interactions
- Double-click to open folders or preview files
- Single click to select
- Ctrl/Cmd click for multi-select
- Right-click for context menu
- Drag to move files/folders
- F2 or click to rename

---

## TECHNICAL APPROACH

### Storage Strategy
- Metadata in database (Supabase)
- Original files in Backblaze B2
- Thumbnails in CDN (Bunny.net)
- Temporary uploads in browser before processing

### File Processing
- Generate thumbnails on upload
- Create preview versions for large files
- Extract metadata (EXIF, dimensions, duration)
- Calculate folder sizes recursively

### Performance Considerations
- Lazy load thumbnails as user scrolls
- Virtual scrolling for large folders
- Progressive upload for large files
- Cache recently viewed items
- Pagination for folders with many items

---

## DEVELOPMENT PHASES

### Phase 1: Basic Structure
- Folder creation and navigation
- File upload functionality
- Basic file/folder display
- Delete operation

### Phase 2: File Operations
- Move files between folders
- Rename functionality
- Multi-select operations
- Trash/recovery system

### Phase 3: Preview System
- Image preview modal
- Video player integration
- Thumbnail generation
- Grid/list view toggle

### Phase 4: Enhanced Features
- Search functionality
- Sort and filter options
- Starred items
- Recent files
- Keyboard shortcuts

### Phase 5: Polish
- Upload progress indicators
- Drag-and-drop refinement
- Context menus
- Mobile responsive design
- Performance optimization

---

## SUCCESS CRITERIA

### Functionality
- Can upload 100+ files at once
- Navigate nested folders smoothly
- Preview files without downloading
- Move/organize files intuitively

### Performance
- Thumbnail load under 100ms
- Folder navigation under 200ms
- Search results under 500ms
- Support folders with 1000+ items

### User Experience
- Familiar interface (like Google Drive)
- No training needed for basic operations
- Visual feedback for all actions
- Undo capability for destructive actions

---

## FUTURE ENHANCEMENTS

After core file manager is complete:
- Tag system for better organization
- Batch rename with patterns
- Smart folders based on criteria
- Team sharing and permissions
- Version history for files
- Comments and annotations
- AI-powered auto-organization
- Integration with video editor timeline

---

## CONSTRAINTS

### Scope Limits
- No real-time collaboration editing
- No office document editing
- No mobile app (web only)
- No offline mode initially

### Technical Limits
- 5GB max file size initially
- 1000 files per folder soft limit
- 10 concurrent uploads maximum

---

## NEXT STEPS

1. Set up Supabase project
2. Configure Backblaze B2 bucket
3. Create basic folder structure UI
4. Implement file upload
5. Add folder navigation
6. Build preview system
7. Test with real media files