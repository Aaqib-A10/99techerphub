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
 * Attachment input with TWO entry points:
 *
 *   • Camera   — opens the device camera directly via `capture="environment"`.
 *                On mobile this launches the back camera; on most desktop
 *                browsers `capture` is ignored and falls back to the file
 *                picker, which is fine — the user can still take a photo
 *                on their laptop or pick an existing image.
 *   • File     — standard file picker, no `capture` hint, also accepts PDFs
 *                so a scanned bill from a desktop scanner works too.
 *
 * Whichever button gets used, the resulting File goes through the same
 * upload + metadata snapshot path. The server-side hard-stop double-
 * checks attachmentUrl is non-empty.
 */
export default function AttachmentInput({
  value,
  onChange,
  required,
  label = 'Attachment',
  hint,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-core-surface p-4 transition ${
            error ? 'border-core-roseFg' : 'border-core-border hover:border-core-text/30'
          }`}
        >
          {/* Camera-first input — mobile launches the back camera. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = ''; // allow re-selecting same file
            }}
          />
          {/* Plain file picker — desktop scans, PDFs, gallery uploads. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-[6px] rounded-lg border border-core-text bg-core-text px-[13px] py-2 text-[12.5px] font-semibold text-core-surface transition hover:opacity-90 disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              {uploading ? 'Uploading…' : 'Take photo'}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-[6px] rounded-lg border border-core-border bg-core-surface px-[13px] py-2 text-[12.5px] font-semibold text-core-text2 transition hover:bg-core-surface2 hover:text-core-text disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Choose file
            </button>
          </div>
          <p className="text-[11px] text-core-text3 text-center">
            {hint ?? 'Take a photo with your camera, or upload an image/PDF from your computer.'}
          </p>
          {error && (
            <p className="text-[11.5px] text-core-roseFg">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
