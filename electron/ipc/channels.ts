// IPC Channel constants
export const IPC_CHANNELS = {
  // Recording
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_READY: 'recording:ready',

  // File operations
  FILE_SAVE_VIDEO: 'file:save-video',
  FILE_LOAD_VIDEO: 'file:load-video',
  FILE_GET_RECORDINGS_DIR: 'file:get-recordings-dir',
  FILE_LIST_ASSETS: 'file:list-assets',

  // App
  APP_GET_SCREEN_SOURCES: 'app:get-screen-sources',
  APP_GET_PATH: 'app:get-path',

  // TTS
  TTS_GENERATE: 'tts:generate',
  TTS_GET_VOICES: 'tts:get-voices',

  // Export
  EXPORT_VIDEO: 'export:video',
  EXPORT_PROGRESS: 'export:progress',
  EXPORT_CANCEL: 'export:cancel',

  // Project save/load
  FILE_HASH: 'file:hash',
  FILE_READ: 'file:read',
  CACHE_CHECK: 'cache:check',
  CACHE_WRITE: 'cache:write',
  DOWNLOAD_URL: 'net:download-url',
} as const
