'use client';

import { useCallback, useRef, useState } from 'react';

export interface DocTypeSpec {
  value: string;
  label: string;
  accept: string; // comma-separated extensions, e.g. ".pdf,.png,.jpg"
  required?: boolean;
}

interface DocumentDropzoneProps {
  docType: DocTypeSpec;
  stagedFile?: File | null;
  onStaged?: (file: File | null) => void; // null = cleared
  onError?: (message: string) => void;
  maxSizeBytes?: number;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

const DEFAULT_MAX = 10 * 1024 * 1024; // 10 MB, matches server

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Validates a single File against a DocTypeSpec.
 * Returns an error message if invalid, otherwise null.
 */
export function validateFile(
  file: File,
  spec: DocTypeSpec,
  maxBytes: number = DEFAULT_MAX
): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExts = spec.accept
    .split(',')
    .map((a) => a.trim().replace(/^\./, '').toLowerCase());
  if (!ext || !allowedExts.includes(ext)) {
    return `Invalid format. Accepted: ${allowedExts.join(', ').toUpperCase()}`;
  }
  if (file.size > maxBytes) {
    return `File too large (max ${humanSize(maxBytes)})`;
  }
  return null;
}

/**
 * Drop-zone for a single document slot.
 * Accepts both clicks and drag-and-drop. Stateless with respect to upload —
 * the parent decides whether to actually upload the file or just stage it.
 */
export default function DocumentDropzone({
  docType,
  stagedFile,
  onStaged,
  onError,
  maxSizeBytes = DEFAULT_MAX,
  disabled = false,
  className = '',
  compact = false,
}: DocumentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      const err = validateFile(file, docType, maxSizeBytes);
      if (err) {
        setLocalError(err);
        onError?.(err);
        return;
      }
      setLocalError('');
      onStaged?.(file);
    },
    [docType, maxSizeBytes, onError, onStaged]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files.length > 1) {
      setLocalError('Drop one file at a time for this slot');
      onError?.('Multiple files dropped');
      return;
    }
    handleFile(files[0]);
  };

  const clear = () => {
    setLocalError('');
    onStaged?.(null);
  };

  const hasFile = !!stagedFile;

  return (
    <div
      className={`border rounded-lg p-3 ${hasFile ? 'border-core-border bg-core-greenSoft/30' : docType.required ? 'border-core-border bg-core-roseSoft/20' : 'border-core-border'} ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {hasFile ? (
            <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
              {'\u2713'}
            </span>
          ) : (
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${docType.required ? 'bg-core-roseSoft text-core-roseFg' : 'bg-core-surface2 text-core-text3'}`}
            >
              {docType.required ? '!' : '?'}
            </span>
          )}
          <h4 className="text-sm font-semibold text-core-text">{docType.label}</h4>
        </div>
        <span className="text-[10px] text-core-text3 font-mono">
          {docType.accept.replace(/\./g, '').toUpperCase()}
        </span>
      </div>

      {localError && <p className="text-xs text-core-roseFg mb-2">{localError}</p>}

      {hasFile ? (
        <div className="flex items-center justify-between bg-core-surface rounded border border-core-border px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-core-text2 truncate">{stagedFile!.name}</p>
            <p className="text-[10px] text-core-text3">{humanSize(stagedFile!.size)}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="ml-2 px-2 py-1 bg-core-roseSoft text-core-roseFg rounded text-xs hover:bg-core-roseSoft font-medium disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <label
          className={`block ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div
            className={`border-2 border-dashed rounded-lg ${compact ? 'p-2' : 'p-3'} text-center transition-colors
              ${disabled ? 'border-core-border bg-core-surface2 opacity-60' : isDragging ? 'border-core-text bg-core-text/10' : 'border-core-border hover:border-core-text hover:bg-core-text/5'}`}
          >
            <svg
              className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} mx-auto text-core-text3 mb-1`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-xs text-core-text3">
              {isDragging ? 'Drop file here' : 'Drag & drop, or click to browse'}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={docType.accept}
            onChange={onInputChange}
            className="hidden"
            disabled={disabled}
          />
        </label>
      )}
    </div>
  );
}
