# Virtual Timeline Engine Pattern

## Overview
The Virtual Timeline Engine Pattern is a performance optimization pattern that separates the visual timeline representation from the actual video playback logic. It creates an abstraction layer that manages frame-based operations, smooth playback, and timeline manipulation without directly interacting with the HTML5 video element's native timeline.

## Problem Solved
Traditional video editing interfaces suffer from:
- Janky playback when manipulating timeline elements
- Performance issues with many clips on timeline
- Complex synchronization between visual timeline and video playback
- Limited control over frame-accurate operations

## Architecture

### Core Components
```typescript
interface VirtualTimelineEngine {
  // Engine control
  play(): void
  pause(): void
  seekToFrame(frame: number): void
  
  // Timeline management
  setSegments(segments: TimelineSegment[]): void
  setVideoElement(element: HTMLVideoElement): void
  
  // Event system
  setCallbacks(callbacks: EngineCallbacks): void
  destroy(): void
}

interface TimelineSegment {
  id: string
  startFrame: number
  endFrame: number
  sourceUrl: string
  sourceInFrame: number
  sourceOutFrame: number
}

interface EngineCallbacks {
  onFrameUpdate: (frame: number) => void
  onPlayStateChange: (playing: boolean) => void
}
```

### Implementation Flow
1. **Initialization**: Engine created with empty segments
2. **Video Element Binding**: HTML5 video element attached
3. **Segment Management**: Clips converted to timeline segments
4. **Playback Control**: Engine manages playback timing
5. **Frame Updates**: Engine emits frame updates to UI

## Key Features

### Frame-Based Timing
- Uses 30 FPS as standard (configurable)
- All operations work in frame units, not seconds
- Enables frame-accurate editing operations

### Smooth Playback
- **Dual-frame system**: `currentFrame` (precise) and `visualFrame` (throttled)
- **30 FPS throttling**: UI updates limited to 33ms intervals
- **Debounced seeking**: Prevents performance issues during drag operations

### Segment Management
- Converts user clips to engine segments
- Handles source in/out points for trimmed clips
- Manages gaps between clips automatically

## Implementation Details

### Engine Initialization
```typescript
// In useVideoEditor hook
useEffect(() => {
  if (!engineRef.current) {
    engineRef.current = new VirtualTimelineEngine()
    
    engineRef.current.setCallbacks({
      onFrameUpdate: (frame) => {
        setCurrentFrame(frame) // Precise frame for editing
        
        // Throttle visual updates to 30 FPS (33ms)
        const now = Date.now()
        if (now - lastVisualUpdateRef.current >= 33) {
          setVisualFrame(frame)
          lastVisualUpdateRef.current = now
        }
      },
      onPlayStateChange: (playing) => setIsPlaying(playing)
    })
  }
  
  if (videoRef.current) {
    engineRef.current.setVideoElement(videoRef.current)
  }
  
  return () => engineRef.current?.destroy()
}, [])
```

### Segment Conversion
```typescript
// Convert user clips to engine segments
useEffect(() => {
  if (!engineRef.current) return
  
  const segments: TimelineSegment[] = clips.map(clip => ({
    id: clip.id,
    startFrame: clip.startFrame,
    endFrame: clip.startFrame + clip.durationFrames,
    sourceUrl: clip.url,
    sourceInFrame: clip.sourceInFrame ?? 0,
    sourceOutFrame: clip.sourceOutFrame ?? 
      (clip.originalDurationFrames ?? clip.durationFrames)
  }))
  
  engineRef.current.setSegments(segments)
}, [clips])
```

### Debounced Seeking
```typescript
const seekToFrame = useCallback((frame: number, immediate = false) => {
  setVisualFrame(frame) // Update visual immediately for responsive UI
  
  if (immediate) {
    // For operations that need immediate seek (like clicking)
    engineRef.current?.seekToFrame(frame)
  } else {
    // Debounced seek for dragging operations (50ms delay)
    pendingSeekFrameRef.current = frame
    
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current)
    }
    
    seekTimeoutRef.current = setTimeout(() => {
      if (pendingSeekFrameRef.current !== null) {
        engineRef.current?.seekToFrame(pendingSeekFrameRef.current)
        pendingSeekFrameRef.current = null
      }
    }, 50)
  }
}, [])
```

## Performance Benefits

### 1. Smooth UI Updates
- Visual frame updates throttled to 30 FPS
- Prevents UI jank during playback
- Maintains responsive editing experience

### 2. Efficient Seeking
- Immediate visual feedback during drag operations
- Debounced actual video seeking
- Reduces unnecessary video element manipulation

### 3. Memory Management
- Clean separation between visual timeline and video playback
- Proper cleanup of blob URLs and engine resources

## Usage Examples

### Basic Playback Control
```typescript
// Play
const play = useCallback(() => {
  engineRef.current?.play()
}, [])

// Pause
const pause = useCallback(() => {
  engineRef.current?.pause()
}, [])

// Seek
const seekToFrame = useCallback((frame: number) => {
  engineRef.current?.seekToFrame(frame)
}, [])
```

### Timeline Operations
```typescript
// Adding a clip automatically updates engine
const handleClipCreated = useCallback((clip: Clip) => {
  setClips(prev => [...prev, clip])
  // Engine automatically picks up new clips via useEffect
}, [])

// Moving a clip
const moveClip = useCallback((clipId: string, newStartFrame: number) => {
  setClips(prev => prev.map(clip => 
    clip.id === clipId ? { ...clip, startFrame: newStartFrame } : clip
  ))
  // Engine updates segments automatically
}, [])
```

## Best Practices

### 1. Frame Consistency
- Always use frame-based calculations
- Convert time to frames using `timeToFrame()` utility
- Maintain frame accuracy across all operations

### 2. State Synchronization
- Use refs for frequently updated state
- Keep engine callbacks minimal and efficient
- Throttle visual updates appropriately

### 3. Resource Management
- Clean up engine on component unmount
- Revoke blob URLs when clips are deleted
- Handle video element detachment properly

### 4. Error Handling
- Handle video element not ready states
- Gracefully handle seek beyond timeline bounds
- Manage playback state transitions

## Common Pitfalls

### 1. Direct Video Element Manipulation
**Avoid**: Directly seeking video element timeline
**Instead**: Use engine's `seekToFrame()` method

### 2. Ignoring Frame Throttling
**Avoid**: Updating UI on every frame update
**Instead**: Use visualFrame for UI, currentFrame for operations

### 3. Poor Resource Cleanup
**Avoid**: Leaving blob URLs or engine running
**Instead**: Proper cleanup in useEffect return and unmount

## Testing Considerations

### Unit Tests
- Test frame conversion utilities
- Verify segment mapping logic
- Test playback state transitions

### Integration Tests
- Test engine-video element synchronization
- Verify UI updates match engine state
- Test performance under load

### Performance Tests
- Measure frame update frequency
- Test memory usage with many clips
- Verify smooth playback under stress

## Extension Points

### Custom Frame Rates
```typescript
// Make FPS configurable
interface EngineOptions {
  fps?: number
  maxSegments?: number
  bufferSize?: number
}
```

### Advanced Features
- Multi-track audio support
- Real-time effects processing
- GPU-accelerated rendering
- Collaborative editing support

## Related Patterns

### Companion Patterns
- **Custom Hook Composition**: Engine integrated via React hook
- **History Management**: Works with undo/redo system
- **Recording Service**: Provides clips for engine segments

### Alternative Approaches
- **Native Video Timeline**: Simpler but less control
- **WebGL Timeline**: More complex but better performance
- **External Libraries**: Potentially less customizable

## Conclusion
The Virtual Timeline Engine Pattern provides a robust foundation for professional video editing applications. It separates concerns between visual representation and actual playback, enabling smooth performance, frame-accurate operations, and extensible architecture. This pattern is essential for any application requiring precise video timeline manipulation with responsive UI.