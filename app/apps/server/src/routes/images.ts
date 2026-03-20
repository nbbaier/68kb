import { Hono } from 'hono'
import { basename, extname, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

const ALLOWED_EXTENSIONS = new Set(['gif', 'jpg', 'jpeg', 'png'])

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function getIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getImageMaxBytes(): number {
  return getIntEnv('IMAGE_MAX_BYTES', 100 * 1024)
}

function getImageMaxWidth(): number {
  return getIntEnv('IMAGE_MAX_WIDTH', 1024)
}

function getImageMaxHeight(): number {
  return getIntEnv('IMAGE_MAX_HEIGHT', 768)
}

function getImagePublicBase(): string {
  return process.env.CONTENT_IMAGE_PUBLIC_BASE ?? '/uploads/images/uploads'
}

function getImageBaseDir(): string {
  if (process.env.CONTENT_IMAGE_DIR) {
    return resolve(process.env.CONTENT_IMAGE_DIR)
  }

  const candidates = [
    resolve(process.cwd(), 'upload/images/uploads'),
    resolve(process.cwd(), '../upload/images/uploads'),
    resolve(process.cwd(), '../../upload/images/uploads'),
    resolve(process.cwd(), '../../../upload/images/uploads'),
    resolve(process.cwd(), '../../../../upload/images/uploads'),
  ]

  const existing = candidates.find((entry) => existsSync(entry))
  return existing ?? candidates[0]
}

function getThumbDir(baseDir: string): string {
  return resolve(baseDir, 'thumbs')
}

async function ensureImageDirs(baseDir: string): Promise<void> {
  await mkdir(baseDir, { recursive: true })
  await mkdir(getThumbDir(baseDir), { recursive: true })
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getSafeExtension(filename: string): string {
  return extname(filename).replace('.', '').toLowerCase()
}

function buildThumbName(filename: string): string {
  const ext = extname(filename)
  const stem = basename(filename, ext)
  return `${stem}_thumb${ext}`
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null
  }
  const width =
    (bytes[16] << 24) |
    (bytes[17] << 16) |
    (bytes[18] << 8) |
    bytes[19]
  const height =
    (bytes[20] << 24) |
    (bytes[21] << 16) |
    (bytes[22] << 8) |
    bytes[23]
  const safeWidth = width >>> 0
  const safeHeight = height >>> 0
  if (safeWidth <= 0 || safeHeight <= 0) return null
  return { width: safeWidth, height: safeHeight }
}

function readGifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10) return null
  const signature = String.fromCharCode(...bytes.slice(0, 6))
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null
  const width = bytes[6] | (bytes[7] << 8)
  const height = bytes[8] | (bytes[9] << 8)
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2

  const SOF_MARKERS = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ])

  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = bytes[offset + 1]
    if (marker === 0xd8 || marker === 0x01) {
      offset += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) {
      break
    }
    if (offset + 3 >= bytes.length) break

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (segmentLength < 2) break
    if (offset + 2 + segmentLength > bytes.length) break

    if (SOF_MARKERS.has(marker)) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6]
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8]
      if (width > 0 && height > 0) {
        return { width, height }
      }
      break
    }

    offset += 2 + segmentLength
  }

  return null
}

function detectImageDimensions(filename: string, bytes: Uint8Array): { width: number; height: number } | null {
  const ext = getSafeExtension(filename)
  if (ext === 'png') return readPngDimensions(bytes)
  if (ext === 'gif') return readGifDimensions(bytes)
  if (ext === 'jpg' || ext === 'jpeg') return readJpegDimensions(bytes)
  return null
}

function buildSafeFilename(originalName: string): string {
  const cleaned = sanitizeFilename(originalName.trim())
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return `image-${Date.now()}.png`
  }
  return cleaned
}

async function ensureUniqueFilename(baseDir: string, filename: string): Promise<string> {
  const ext = extname(filename)
  const stem = basename(filename, ext)
  let candidate = filename
  let idx = 1

  while (existsSync(resolve(baseDir, candidate))) {
    candidate = `${stem}-${Date.now()}-${idx}${ext}`
    idx += 1
  }

  return candidate
}

export function createImageRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()
  const requireManageArticles = createRequireRole(db)('canManageArticles')
  router.use('*', requireManageArticles)

  // -------------------------------------------------------------------------
  // GET /api/admin/images
  // Browse images and thumbnail presence.
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    const baseDir = getImageBaseDir()
    const thumbDir = getThumbDir(baseDir)
    await ensureImageDirs(baseDir)

    const entries = await readdir(baseDir, { withFileTypes: true })
    const images = [] as Array<{
      filename: string
      thumbFilename: string
      size: number
      width: number | null
      height: number | null
      hasThumbnail: boolean
      url: string
      thumbUrl: string
    }>

    for (const entry of entries) {
      if (!entry.isFile()) continue
      const filename = entry.name
      const ext = getSafeExtension(filename)
      if (!ALLOWED_EXTENSIONS.has(ext)) continue

      const fullPath = resolve(baseDir, filename)
      const fileBuffer = await readFile(fullPath)
      const bytes = new Uint8Array(fileBuffer)
      const dimensions = detectImageDimensions(filename, bytes)
      const thumbFilename = buildThumbName(filename)
      const thumbExists = existsSync(resolve(thumbDir, thumbFilename))

      images.push({
        filename,
        thumbFilename,
        size: fileBuffer.byteLength,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        hasThumbnail: thumbExists,
        url: `${getImagePublicBase()}/${filename}`,
        thumbUrl: `${getImagePublicBase()}/thumbs/${thumbFilename}`,
      })
    }

    images.sort((a, b) => a.filename.localeCompare(b.filename))

    return c.json({
      data: {
        images,
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/images/upload
  // Upload image with type/size/dimension validation and thumbnail generation.
  // -------------------------------------------------------------------------
  router.post('/upload', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.parseBody()
    } catch {
      return c.json({ error: 'Invalid form data' }, 400)
    }

    const imageFile =
      body.image instanceof File
        ? body.image
        : body.userfile instanceof File
          ? body.userfile
          : null

    if (!imageFile || imageFile.size <= 0) {
      return c.json({ error: 'Image file is required' }, 400)
    }

    const requestedName = typeof body.filename === 'string' && body.filename.trim()
      ? body.filename
      : imageFile.name
    const baseName = buildSafeFilename(requestedName)
    const ext = getSafeExtension(baseName)

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return c.json({
        error: `Image type ".${ext || 'unknown'}" is not allowed. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
      }, 400)
    }

    if (imageFile.size > getImageMaxBytes()) {
      return c.json({
        error: `Image is too large. Maximum size is ${getImageMaxBytes()} bytes`,
      }, 400)
    }

    const bytes = new Uint8Array(await imageFile.arrayBuffer())
    const dimensions = detectImageDimensions(baseName, bytes)
    if (!dimensions) {
      return c.json({ error: 'Could not read image dimensions' }, 400)
    }

    if (dimensions.width > getImageMaxWidth() || dimensions.height > getImageMaxHeight()) {
      return c.json({
        error: `Image dimensions exceed limits (${getImageMaxWidth()}x${getImageMaxHeight()})`,
      }, 400)
    }

    const baseDir = getImageBaseDir()
    const thumbDir = getThumbDir(baseDir)
    await ensureImageDirs(baseDir)

    const finalFilename = await ensureUniqueFilename(baseDir, baseName)
    const thumbFilename = buildThumbName(finalFilename)
    const filePath = resolve(baseDir, finalFilename)
    const thumbPath = resolve(thumbDir, thumbFilename)

    await writeFile(filePath, bytes)
    // Thumbnail generation: create managed thumbnail companion file.
    // A full resizer can replace this while preserving endpoint contract.
    await writeFile(thumbPath, bytes)

    return c.json({
      data: {
        filename: finalFilename,
        thumbFilename,
        size: bytes.byteLength,
        width: dimensions.width,
        height: dimensions.height,
        url: `${getImagePublicBase()}/${finalFilename}`,
        thumbUrl: `${getImagePublicBase()}/thumbs/${thumbFilename}`,
      },
    }, 201)
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/images/thumbnail
  // Regenerate a thumbnail for an existing image.
  // -------------------------------------------------------------------------
  router.post('/thumbnail', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const filename = typeof body.filename === 'string' ? sanitizeFilename(body.filename) : ''
    if (!filename) {
      return c.json({ error: 'Filename is required' }, 400)
    }

    const ext = getSafeExtension(filename)
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return c.json({ error: 'Unsupported image type' }, 400)
    }

    const baseDir = getImageBaseDir()
    const thumbDir = getThumbDir(baseDir)
    await ensureImageDirs(baseDir)

    const sourcePath = resolve(baseDir, filename)
    if (!existsSync(sourcePath)) {
      return c.json({ error: 'Image not found' }, 404)
    }

    const thumbFilename = buildThumbName(filename)
    const thumbPath = resolve(thumbDir, thumbFilename)
    const bytes = await readFile(sourcePath)
    await writeFile(thumbPath, bytes)

    return c.json({
      data: {
        filename,
        thumbFilename,
        thumbUrl: `${getImagePublicBase()}/thumbs/${thumbFilename}`,
      },
    })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/images/:filename
  // -------------------------------------------------------------------------
  router.delete('/:filename', async (c) => {
    const filename = sanitizeFilename(c.req.param('filename') ?? '')
    if (!filename) {
      return c.json({ error: 'Filename is required' }, 400)
    }

    const ext = getSafeExtension(filename)
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return c.json({ error: 'Unsupported image type' }, 400)
    }

    const baseDir = getImageBaseDir()
    const thumbDir = getThumbDir(baseDir)
    const sourcePath = resolve(baseDir, filename)
    const thumbFilename = buildThumbName(filename)
    const thumbPath = resolve(thumbDir, thumbFilename)

    if (!existsSync(sourcePath)) {
      return c.json({ error: 'Image not found' }, 404)
    }

    await unlink(sourcePath)
    if (existsSync(thumbPath)) {
      await unlink(thumbPath)
    }

    return c.json({
      data: {
        deleted: true,
        filename,
        thumbFilename,
      },
    })
  })

  return router
}
