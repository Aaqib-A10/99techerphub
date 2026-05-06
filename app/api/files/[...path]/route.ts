import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join, normalize, sep } from 'path';
import { getSessionUser } from '@/lib/auth';

/**
 * Serve uploaded files (receipts, bill scans, cheque scans, OPEX
 * vouchers, ledger attachments) through an auth-protected API route.
 *
 * Why this exists rather than serving from /public/uploads/:
 *   1. Next.js's static handler in production didn't reliably serve
 *      files written to /public/ AFTER `next build` ran — uploads
 *      worked locally but 404'd on prod.
 *   2. Receipts shouldn't be world-readable. Going through this route
 *      enforces a session check on every download.
 *   3. Storing uploads inside the build-managed tree is fragile across
 *      deploys; this route reads from a stable directory outside it.
 *
 * Storage layout:
 *   process.env.UPLOADS_DIR = /home/erp/99tech-erp-uploads (prod, optional)
 *   default                  = <cwd>/uploads               (gitignored)
 *
 * URL pattern:  /api/files/<bucket>/<filename>
 * Disk path:    <UPLOADS_DIR>/<bucket>/<filename>
 *
 * The `bucket` is the immediate sub-directory; new buckets can be
 * added without code changes by extending ALLOWED_BUCKETS below.
 */

const ALLOWED_BUCKETS = new Set(['receipts']);

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  webp: 'image/webp',
  gif: 'image/gif',
};

function uploadsRoot(): string {
  const fromEnv = process.env.UPLOADS_DIR;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return join(process.cwd(), 'uploads');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const segments = params.path ?? [];
  if (segments.length < 2) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const bucket = segments[0];
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'Unknown bucket' }, { status: 404 });
  }

  // Reject path-traversal attempts. Every segment must be a plain
  // filename — without this, /api/files/receipts/../../etc/passwd
  // would escape the uploads root.
  for (const seg of segments) {
    if (
      !seg ||
      seg === '.' ||
      seg === '..' ||
      seg.includes('/') ||
      seg.includes('\\') ||
      seg.includes('\0')
    ) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
  }

  const root = uploadsRoot();
  const filepath = normalize(join(root, ...segments));

  // Defense in depth: even if the segment check missed something, the
  // resolved path must still be inside the uploads root.
  if (!filepath.startsWith(root + sep) && filepath !== root) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  let buffer: Buffer;
  let size: number;
  try {
    const s = await stat(filepath);
    if (!s.isFile()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    size = s.size;
    buffer = await readFile(filepath);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = filepath.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
  const filename = segments[segments.length - 1];

  // Buffer is a Uint8Array at runtime; cast keeps TS happy without an
  // unnecessary copy.
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      'Cache-Control': 'private, max-age=300, must-revalidate',
      'Content-Disposition': `inline; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
