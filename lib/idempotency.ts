/**
 * Idempotency layer — prevents duplicate mutations from double-clicks,
 * network retries, or browser re-submits.
 *
 * Usage in API routes:
 *   const key = request.headers.get('X-Idempotency-Key');
 *   const cached = await checkIdempotency(key);
 *   if (cached) return cached;
 *   // ... do work ...
 *   await saveIdempotency(key, 'POST', '/api/expenses', 201, responseData);
 */

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Check if this request was already processed.
 * Returns the cached response if found, null otherwise.
 * If no key is provided, returns null (backward compatible).
 */
export async function checkIdempotency(key: string | null): Promise<NextResponse | null> {
  if (!key) return null;

  try {
    const existing = await prisma.requestLog.findUnique({
      where: { idempotencyKey: key },
    });

    if (existing) {
      return NextResponse.json(existing.responseBody, {
        status: existing.statusCode,
        headers: { 'X-Idempotent-Replay': 'true' },
      });
    }
  } catch {
    // If the table doesn't exist yet (pre-migration), skip silently
  }

  return null;
}

/**
 * Save the response so future duplicate requests get the cached result.
 */
export async function saveIdempotency(
  key: string | null,
  method: string,
  path: string,
  statusCode: number,
  responseBody: any
): Promise<void> {
  if (!key) return;

  try {
    await prisma.requestLog.create({
      data: { idempotencyKey: key, method, path, statusCode, responseBody },
    }).catch(() => {});
  } catch {
    // Silently ignore — idempotency is best-effort, never blocks the main flow
  }
}
