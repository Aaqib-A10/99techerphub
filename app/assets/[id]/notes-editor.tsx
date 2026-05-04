'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface NotesEditorProps {
  assetId: number;
  currentNotes: string;
}

export default function NotesEditor({ assetId, currentNotes }: NotesEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(currentNotes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to update notes');
      }

      router.refresh();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNotes(currentNotes);
    setIsEditing(false);
    setError('');
  };

  if (!isEditing) {
    return (
      <div>
        {notes ? (
          <p className="mb-3 text-[13px] text-core-text">{notes}</p>
        ) : (
          <p className="mb-3 text-[13px] text-core-text3">No notes added yet</p>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-[5px] rounded-lg border border-core-border bg-core-surface px-[10px] py-[5px] text-[12px] font-semibold text-core-text2 transition hover:bg-core-surface2 hover:text-core-text"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {notes ? 'Edit Notes' : 'Add Notes'}
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-3 p-2 bg-core-roseSoft border border-red-400 text-core-roseFg rounded text-sm">
          {error}
        </div>
      )}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Enter notes about this asset"
        rows={4}
        className="form-textarea w-full mb-3"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary text-sm disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="btn btn-secondary text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
