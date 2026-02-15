import { desktopCapturer } from 'electron'

// Screen recording utilities for the main process
// The actual recording happens in the renderer via MediaRecorder,
// but the main process handles:
// 1. Auto-granting screen capture permissions via setDisplayMediaRequestHandler
// 2. Providing screen sources list
// 3. Saving recorded video files to disk

export async function getScreenSources() {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
  })

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }))
}
