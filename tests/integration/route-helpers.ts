/**
 * Helpers for testing Next.js App Router route handlers directly.
 *
 * Approach: import the route's exported `DELETE` / `POST` / etc. and call it
 * with a synthetic NextRequest. Auth is mocked per-suite via `vi.mock` of
 * `@/lib/auth` because the real version reads `next/headers` cookies, which
 * vitest can't supply.
 */
import { NextRequest } from 'next/server';

export function makeRequest(
  url: string,
  init: RequestInit & { method?: string } = {},
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost').toString(), init);
}

export async function readJson(res: Response): Promise<any> {
  return await res.json().catch(() => ({}));
}

/**
 * Stand-in for the User shape that getSessionUser/requireRole returns.
 * Only the fields the route handlers actually read are required.
 */
export interface FakeUser {
  id: number;
  email: string;
  role: 'ADMIN' | 'HR' | 'MANAGER' | 'ACCOUNTANT' | 'EMPLOYEE';
  employeeId?: number | null;
}
