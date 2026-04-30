'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const NAVY = '#0B1F3A';
const TEAL_DEEP = '#006B5F';
const INK = '#0B1C30';
const OUTLINE = '#75777E';

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Missing token. Use the link from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Reset failed');
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#F2F5FA' }}
    >
      <div
        className="w-full max-w-md bg-white rounded-xl p-8 shadow-[0_8px_32px_rgba(11,31,58,0.08)]"
      >
        <h1 className="text-[22px] font-bold mb-1" style={{ color: INK }}>
          Set a new password
        </h1>
        <p className="text-sm mb-6" style={{ color: OUTLINE }}>
          Pick a password you'll remember. Your active sessions will be ended
          after this so you can sign in fresh.
        </p>

        {!token && (
          <div className="mb-4 rounded-md bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-[13px] px-3 py-2">
            This link is missing its token. Request a new reset email.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-[13px] px-3 py-2">
            {error}
          </div>
        )}

        {done ? (
          <div className="rounded-md bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 text-[14px] px-3 py-3">
            ✓ Password updated. Redirecting to sign in…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-[11px] font-bold uppercase tracking-wider mb-1"
                style={{ color: OUTLINE }}
              >
                New password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md ring-1 ring-zinc-200 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label
                className="block text-[11px] font-bold uppercase tracking-wider mb-1"
                style={{ color: OUTLINE }}
              >
                Confirm new password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md ring-1 ring-zinc-200 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !token}
              className="w-full rounded-md py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
              style={{ background: NAVY }}
            >
              {submitting ? 'Updating…' : 'Set password'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-[12px] font-semibold uppercase tracking-widest"
            style={{ color: TEAL_DEEP }}
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
