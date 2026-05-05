'use client';

import { useRef, useState } from 'react';

export interface AttachmentValue {
  url: string;
  meta?: {
    capturedAt?: string; // ISO from browser file.lastModified
    fileName?: string;
    fileSize?: number;
    fileType?: string;
  };
}

interface Props {
  value: AttachmentValue | null;
  onChange: (next: AttachmentValue | null) => void;
  required?: boolean;
  label?: string;
  hint?: string;
}

/**
 * File-upload input for the ledger tabs. Hits /api/upload and stores
 * the returned URL + a small client-side metadata snapshot
 * (lastModified, name, size). The server-side hard-stop double-checks
 * presence; this is just the UI affordance.
 *
 * Capture timestamp comes from browser File.lastModified — accurate for
 * actual photos taken on mobile, less so for re-uploaded scans, but
 * good enough for the drift check.
 */
export default function AttachmentInput({
  value,
  onChange,
  required,
  label = 'Attachment',
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      onChange({
        url: data.url,
        meta: {
          capturedAt: new Date(file.lastModified).toISOString(),
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="form-label">
        {label} {required && <span className="text-core-roseFg">*</span>}
      </label>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-core-border bg-core-surface2 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.url}
            alt="attachment"
            className="h-14 w-14 rounded-md object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="min-w-0 flex-1">
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-[12.5px] font-medium text-core-text underline-offset-2 hover:underline"
            >
              {value.meta?.fileName ?? 'Open file'}
            </a>
            {value.meta?.capturedAt && (
              <div className="mt-[2px] text-[11px] text-core-text3">
                Captured {new Date(value.meta.capturedAt).toLocaleString()}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[12px] font-semibold text-core-text3 hover:text-core-roseFg"
          >
            Replace
          </button>
        </div>
      ) : (
        <div
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-core-surface p-4 transition ${
            error ? 'border-core-roseFg' : 'border-core-border hover:border-core-text/30'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn btn-sm btn-secondary"
          >
            {uploading ? 'Uploading…' : 'Upload receipt / scan'}
          </button>
          <p className="text-[11px] text-core-text3">
            {hint ?? 'Image or PDF. On mobile, your camera opens directly.'}
          </p>
          {error && (
            <p className="text-[11.5px] text-core-roseFg">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
