'use client';

import { useEffect, useRef, useState } from 'react';

export interface AttachmentValue {
  url: string;
  meta?: {
    capturedAt?: string;
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

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Attachment input that mirrors the receipt upload on /expenses/new:
 *   - "Upload via Camera" → real getUserMedia stream with capture button
 *     (works on desktop laptops with webcams, not just mobile)
 *   - "Select from Gallery" → standard file picker, accepts JPG/PNG/PDF
 *
 * Server-side hard-stop double-checks that attachmentUrl is non-empty.
 * Used by Billing, Cheques, and OPEX forms in the Finance Ledger.
 */
export default function AttachmentInput({
  value,
  onChange,
  required,
  label = 'Receipt Upload',
  hint = 'Take a photo or choose a receipt from your device',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');

  async function uploadFile(file: File) {
    if (file.size > MAX_BYTES) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max 5MB.`);
      return;
    }
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

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const openCamera = async () => {
    setCameraError('');
    setError('');
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setError(
        'Camera is not available in this browser. Use "Select from Gallery" instead.',
      );
      return;
    }
    setCameraOpen(true);
    setCameraStarting(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      const name = err?.name || '';
      let msg = 'Could not access the camera.';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        msg =
          'Camera permission was denied. Allow camera access in your browser settings and try again.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No camera was found on this device.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        msg = 'The camera is already in use by another application.';
      } else if (
        typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        msg =
          'Camera access requires HTTPS. Open this page over HTTPS (or use localhost) and try again.';
      }
      setCameraError(msg);
    } finally {
      setCameraStarting(false);
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setCameraOpen(false);
    setCameraError('');
  };

  const captureFromCamera = async () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setCameraError('Camera is still initializing. Please wait a moment and try again.');
      return;
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Failed to capture image.');
          return;
        }
        const file = new File([blob], `receipt-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        closeCamera();
        void uploadFile(file);
      },
      'image/jpeg',
      0.92,
    );
  };

  // Stop camera if component unmounts while it's still open.
  useEffect(() => {
    return () => stopCameraStream();
  }, []);

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
        <>
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-core-surface px-4 py-8 transition ${
              error ? 'border-core-roseFg' : 'border-core-border hover:border-core-text/30'
            }`}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-core-text3"
            >
              <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
            </svg>
            <div className="mt-1 text-center">
              <div className="text-[13px] font-medium text-core-text">{hint}</div>
              <div className="mt-[2px] text-[11px] text-core-text3">
                Supports JPG, PNG, PDF up to 5MB
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={openCamera}
                disabled={uploading}
                className="inline-flex items-center gap-[6px] rounded-lg border border-core-text bg-core-text px-[13px] py-2 text-[12.5px] font-semibold text-core-surface transition hover:opacity-90 disabled:opacity-50"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Upload via Camera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-[6px] rounded-lg border border-core-border bg-core-surface px-[13px] py-2 text-[12.5px] font-semibold text-core-text2 transition hover:bg-core-surface2 hover:text-core-text disabled:opacity-50"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Select from Gallery
              </button>
            </div>
            {uploading && (
              <p className="text-[11.5px] text-core-text3">Uploading…</p>
            )}
            {error && <p className="text-[11.5px] text-core-roseFg">{error}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = '';
            }}
          />
        </>
      )}

      {/* Live camera preview modal — uses the same getUserMedia flow as
          /expenses/new so behavior is consistent across the app. */}
      {cameraOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={closeCamera}
        >
          <div
            className="w-full max-w-[640px] overflow-hidden rounded-2xl bg-core-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-core-border px-4 py-3">
              <h3 className="text-[14px] font-semibold text-core-text">Take photo</h3>
              <button
                type="button"
                onClick={closeCamera}
                className="text-core-text3 hover:text-core-text"
                aria-label="Close camera"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="bg-black">
              {cameraStarting && (
                <div className="flex h-[280px] items-center justify-center text-[12px] text-white/80">
                  Starting camera…
                </div>
              )}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`block w-full ${cameraStarting ? 'hidden' : ''}`}
                style={{ maxHeight: '60vh' }}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            {cameraError && (
              <div className="bg-core-roseSoft px-4 py-2 text-[12px] text-core-roseFg">
                {cameraError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 border-t border-core-border px-4 py-3">
              <button
                type="button"
                onClick={closeCamera}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureFromCamera}
                disabled={cameraStarting || !!cameraError}
                className="btn btn-primary"
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
