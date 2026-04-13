'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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

// Print-only portal: renders a single label directly under <body> so we can
// hide everything else with `display: none` and guarantee ONE copy on the page.
function PrintPortal({ asset }: { asset: LabelAsset }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div id="print-label-root">
      <div className="print-label-box">
        <img
          src={`/api/assets/${asset.id}/qr`}
          alt="Asset QR Code"
          width={140}
          height={140}
        />
        <p>{asset.assetTag}</p>
      </div>
    </div>,
    document.body
  );
}

export default function LabelClient({ asset }: { asset: LabelAsset }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Print Asset Label</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tag <span className="font-mono font-semibold text-gray-700">{asset.assetTag}</span> · use the button to print just the small label
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-secondary hover:shadow active:scale-95"
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
      <div className="flex justify-center no-print">
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8">
          <p className="mb-4 text-center text-xs uppercase tracking-widest text-gray-500">
            Preview
          </p>
          <div className="inline-flex flex-col items-center rounded-lg border border-gray-900 bg-white p-3 shadow">
            <img
              src={`/api/assets/${asset.id}/qr`}
              alt="Asset QR Code"
              width={128}
              height={128}
              className="h-32 w-32"
            />
            <p className="mt-2 text-center font-mono text-xs font-semibold tracking-tight text-gray-900">
              {asset.assetTag}
            </p>
          </div>
        </div>
      </div>

      {/* Print-only copy via portal, lives as direct child of <body> */}
      <PrintPortal asset={asset} />

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
