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
          <div>
            <p className="text-core-text text-sm mb-3">{notes}</p>
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-core-text2 hover:text-core-greenFg font-medium"
            >
              Edit Notes
            </button>
          </div>
        ) : (
          <div>
            <p className="text-core-text3 text-sm mb-3">No notes added yet</p>
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-core-text2 hover:text-core-greenFg font-medium"
            >
              Add Notes
            </button>
          </div>
        )}
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
