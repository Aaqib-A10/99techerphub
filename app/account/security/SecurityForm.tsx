'use client';

import { useState } from 'react';

interface Props {
  email: string;
  isSsoOnly: boolean;
}

export default function SecurityForm({ email, isSsoOnly }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: isSsoOnly ? undefined : currentPassword,
          newPassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not update password');
      }
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err: any) {
      setError(err.message || 'Could not update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg ring-1 ring-core-border/85 bg-core-surface p-5">
      <h2 className="text-[15px] font-semibold text-core-text mb-1">
        {isSsoOnly ? 'Set a password' : 'Change your password'}
      </h2>
      <p className="text-[12.5px] text-core-text3 mb-4">
        Signed in as <span className="mono text-core-text2">{email}</span>
      </p>

      {done ? (
        <div className="rounded-md bg-core-greenSoft ring-1 ring-core-greenFg text-core-greenFg text-[13px] px-3 py-3">
          ✓ Password updated.
          {isSsoOnly && ' You can now sign in with email + password as well as Microsoft.'}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isSsoOnly && (
            <div>
              <label className="form-label">Current password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="form-input"
              />
            </div>
          )}
          <div>
            <label className="form-label">New password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="form-label">Confirm new password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="form-input"
            />
          </div>

          {error && (
            <div className="rounded-md bg-core-roseSoft ring-1 ring-rose-200 text-core-roseFg text-[13px] px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ backgroundColor: '#0B1F3A' }}
          >
            {submitting ? 'Saving…' : isSsoOnly ? 'Set password' : 'Change password'}
          </button>
        </form>
      )}
    </div>
  );
}
