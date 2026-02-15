/**
 * Backblaze B2 Storage Service for Content King
 * Adapted from muscled-team/src/lib/backblaze.ts
 * Uses shared bucket `unpuzzle-mvp` with prefix isolation: content-king/...
 */

import B2 from 'backblaze-b2'
import { createHash } from 'crypto'

const B2_PREFIX = 'content-king'

const B2_APPLICATION_KEY_ID = '005d47d80d78ddd0000000003'
const B2_APPLICATION_KEY = 'K005fApZ09Y2JOzk9GtiS5OkboHAibc'
const B2_BUCKET_ID = '5d2457bda8a00d67989d0d1d'

class BackblazeStorage {
  private b2: B2
  private isAuthorized = false
  private bucketId: string = B2_BUCKET_ID

  constructor() {
    this.b2 = new B2({
      applicationKeyId: B2_APPLICATION_KEY_ID,
      applicationKey: B2_APPLICATION_KEY,
    })
  }

  private async authorize(): Promise<void> {
    if (this.isAuthorized) return

    await this.b2.authorize()
    this.isAuthorized = true
    console.log('[B2] Authorized successfully')
  }

  /**
   * Upload a file buffer to B2.
   * Logs success/failure but never throws (fire-and-forget usage).
   * @param buffer - File contents
   * @param key - Path within the content-king/ prefix (e.g. "recordings/recording-123.webm")
   * @param contentType - MIME type
   */
  async uploadFile(buffer: Buffer, key: string, contentType: string): Promise<void> {
    try {
      await this.authorize()

      const fileName = `${B2_PREFIX}/${key}`
      const sha1 = createHash('sha1').update(buffer).digest('hex')

      const uploadUrlResponse = await this.b2.getUploadUrl({
        bucketId: this.bucketId,
      })

      const { uploadUrl, authorizationToken } = uploadUrlResponse.data

      await this.b2.uploadFile({
        uploadUrl,
        uploadAuthToken: authorizationToken,
        fileName,
        data: buffer,
        hash: sha1,
      })

      console.log(`[B2] Uploaded ${fileName} successfully`)
    } catch (error) {
      // Re-authorize on next attempt if auth failed
      this.isAuthorized = false
      console.error(`[B2] Upload failed for ${key}:`, error)
    }
  }
}

// Singleton
export const b2Storage = new BackblazeStorage()
