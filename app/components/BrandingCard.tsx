'use client';

import { useEffect, useRef, useState } from 'react';

export default function BrandingCard() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current logo on mount
  useEffect(() => {
    void fetchLogo();
  }, []);

  // Auto-dismiss toasts
  useEffect(() => {
    if (!success && !error) return;
    const t = setTimeout(() => {
      setSuccess('');
      setError('');
    }, 4000);
    return () => clearTimeout(t);
  }, [success, error]);

  const fetchLogo = async () => {
    try {
      const res = await fetch('/api/settings/logo', { cache: 'no-store' });
      const data = await res.json();
      setLogoUrl(data?.logo?.url || null);
    } catch {
      setLogoUrl(null);
    }
  };

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Upload failed');
      }
      setLogoUrl(data.logo?.url || null);
      setSuccess('Logo uploaded successfully');
      // Signal other components (sidebar) to re-fetch the logo
      window.dispatchEvent(new CustomEvent('logo-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    // Reset input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  };

  const handleRemove = async () => {
    if (!confirm('Remove the current logo? The app will fall back to the default 99T mark.')) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/settings/logo', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Remove failed');
      }
      setLogoUrl(null);
      setSuccess('Logo removed');
      window.dispatchEvent(new CustomEvent('logo-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-6">
      <div className="card-header">
        <h2 className="section-heading">Branding</h2>
      </div>
      <div className="card-body">
        <p className="text-sm text-gray-600 mb-4">
          Upload your company logo. It appears in the sidebar and throughout
          the app. PNG, JPG, SVG, or WebP up to 2&nbsp;MB.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
          {/* Preview tile */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-full aspect-square rounded-xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center overflow-hidden shadow-sm">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Current logo"
                  className="max-w-[80%] max-h-[80%] object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-gray-400">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-primary to-emerald-600 flex items-center justify-center shadow-md mb-2">
                    <span className="text-white font-black text-xl">99</span>
                  </div>
                  <span className="text-[11px] font-medium">Default</span>
                </div>
              )}
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
              {logoUrl ? 'Current logo' : 'Using default'}
            </span>
          </div>

          {/* Drop zone + actions */}
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed transition-all p-8 text-center ${
                dragOver
                  ? 'border-brand-primary bg-emerald-50'
                  : 'border-gray-300 bg-gray-50 hover:border-brand-primary/40 hover:bg-emerald-50/40'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <div className="text-sm font-semibold text-gray-700">
                  {loading ? 'Uploading…' : 'Click or drop image here'}
                </div>
                <div className="text-[11px] text-gray-500">
                  PNG · JPG · SVG · WebP · up to 2 MB
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="btn btn-primary btn-sm"
              >
                {loading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={loading}
                  className="btn btn-secondary btn-sm"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="text-[11px] text-gray-500">
              Tip: square logos work best in the sidebar. Transparent PNG or
              SVG recommended.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
