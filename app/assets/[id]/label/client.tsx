'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';

interface LabelAsset {
  id: number;
  assetTag: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  categoryName: string;
  companyName: string;
  locationName: string;
}

/**
 * Generate the QR code in the browser using `window.location.origin`.
 *
 * Server-side QR generation kept failing on prod because the Next.js
 * server (running on localhost:3000 behind Cloudflare) couldn't
 * reliably tell what its own public URL was — it'd embed
 * http://localhost:3000 in the SVG. Doing the encoding here removes
 * the guessing entirely: the URL the QR points at is, by definition,
 * the same URL the user is currently looking at.
 */
function useQrDataUrl(assetTag: string): { dataUrl: string | null; payload: string | null } {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [payload, setPayload] = useState<string | null>(null);

  // Read the live origin once on mount (window doesn't exist during SSR).
  // Re-deriving on every render isn't useful — origin doesn't change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/assets/scan?tag=${encodeURIComponent(assetTag)}`;
    setPayload(url);
  }, [assetTag]);

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return { dataUrl, payload };
}

// Print-only portal: renders a single label directly under <body> so we can
// hide everything else with `display: none` and guarantee ONE copy on the page.
function PrintPortal({ asset, qrDataUrl }: { asset: LabelAsset; qrDataUrl: string | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === 'undefined' || !qrDataUrl) return null;

  return createPortal(
    <div id="print-label-root">
      <div className="print-label-box">
        <img src={qrDataUrl} alt="Asset QR Code" width={140} height={140} />
        <p>{asset.assetTag}</p>
      </div>
    </div>,
    document.body,
  );
}

export default function LabelClient({ asset }: { asset: LabelAsset }) {
  const { dataUrl: qrDataUrl, payload: qrPayload } = useQrDataUrl(asset.assetTag);
  const looksLocal = !!qrPayload && /localhost|127\.0\.0\.1/.test(qrPayload);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-3xl font-bold text-core-text">Print Asset Label</h1>
          <p className="mt-1 text-sm text-core-text3">
            Tag <span className="font-mono font-semibold text-core-text2">{asset.assetTag}</span> · use the button to print just the small label
          </p>
        </div>
        <button
          onClick={() => window.print()}
          disabled={!qrDataUrl}
          className="inline-flex items-center gap-2 rounded-lg bg-core-text px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-core-green hover:shadow active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          Print Label
        </button>
      </div>

      {/* On-screen preview — hidden during print */}
      <div className="flex flex-col items-center gap-3 no-print">
        <div className="rounded-2xl border-2 border-dashed border-core-border bg-core-surface2 p-8">
          <p className="mb-4 text-center text-xs uppercase tracking-widest text-core-text3">
            Preview
          </p>
          <div className="inline-flex flex-col items-center rounded-lg border border-gray-900 bg-core-surface p-3 shadow">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Asset QR Code"
                width={128}
                height={128}
                className="h-32 w-32"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center text-[10px] text-core-text3">
                Generating…
              </div>
            )}
            <p className="mt-2 text-center font-mono text-xs font-semibold tracking-tight text-core-text">
              {asset.assetTag}
            </p>
          </div>
        </div>

        {/* Decoded payload — so the operator can verify what's encoded
            BEFORE printing dozens of stickers. Flagged red if it
            resolves to a local origin so they can't miss the misconfig. */}
        {qrPayload && (
          <div
            className={`max-w-[420px] rounded-xl border px-4 py-3 text-center ${
              looksLocal
                ? 'border-core-roseFg/40 bg-core-roseSoft text-core-roseFg'
                : 'border-core-border bg-core-surface text-core-text2'
            }`}
          >
            <div
              className="mb-1 text-[10px] font-semibold uppercase"
              style={{ letterSpacing: '0.09em' }}
            >
              {looksLocal ? 'Encoded URL — looks wrong' : 'Encoded URL'}
            </div>
            <a
              href={qrPayload}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-[11px] underline-offset-2 hover:underline"
            >
              {qrPayload}
            </a>
            {looksLocal && (
              <p className="mt-2 text-[11px]">
                You're viewing this page through a local URL, so the QR will encode
                that. Open the same page on the production domain before printing.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Print-only copy via portal, lives as direct child of <body> */}
      <PrintPortal asset={asset} qrDataUrl={qrDataUrl} />

      <style jsx global>{`
        /* Hide print portal on screen */
        #print-label-root {
          display: none;
        }

        @media print {
          @page {
            size: 60mm 60mm;
            margin: 0;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide every direct child of <body> except the print portal */
          body > *:not(#print-label-root) {
            display: none !important;
          }
          /* Show the print portal */
          #print-label-root {
            display: block !important;
            width: 60mm;
            height: 60mm;
          }
          .print-label-box {
            width: 60mm;
            height: 60mm;
            padding: 4mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          .print-label-box img {
            width: 45mm;
            height: 45mm;
            display: block;
          }
          .print-label-box p {
            margin: 2mm 0 0 0;
            font-family: ui-monospace, Menlo, Monaco, monospace;
            font-size: 10pt;
            font-weight: 600;
            color: #000;
            text-align: center;
            letter-spacing: -0.01em;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
