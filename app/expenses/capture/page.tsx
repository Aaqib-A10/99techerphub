'use client';

/**
 * Expense Capture — Mobile Wizard
 * Route: /expenses/capture
 *
 * Architectural Ledger design system.
 * Implemented as a 3-step wizard:
 *   1. Capture Receipt (camera + upload) → auto-OCR
 *   2. Details (category, amount, vendor, date, description)
 *   3. Review & Submit
 *
 * Uses inline style={{}} hex constants to bypass Tailwind config
 * hot-reload issues, consistent with the rest of the Ledger screens.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ────────────────────────────────────────────────────────────────
// Architectural Ledger palette
// ────────────────────────────────────────────────────────────────
const NAVY = '#0B1F3A';
const NAVY_HOVER = '#152B4C';
const TEAL = '#14B8A6';
const TEAL_DEEP = '#006B5F';
const TEAL_TINT = '#E6FAF6';
const SURFACE = '#F8F9FF';
const SURFACE_LOW = '#EFF4FF';
const SURFACE_LOWEST = '#FFFFFF';
const SURFACE_HIGH = '#DCE9FF';
const INK = '#0B1C30';
const INK_MUTED = '#44474D';
const OUTLINE = '#75777E';
const OUTLINE_VARIANT = '#C4C6CE';
const AMBER = '#F59E0B';
const ROSE = '#E11D48';

const MONO = 'var(--font-jetbrains-mono), monospace';

type Step = 1 | 2 | 3;

type OcrResult = {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  expenseDate: string | null;
  invoiceNumber: string | null;
  description: string | null;
  categorySuggestion: string | null;
  confidence: string;
};

export default function ExpenseCapturePage() {
  const router = useRouter();

  // ── Wizard ────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // ── File / camera ─────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraStarting, setCameraStarting] = useState(false);

  // ── OCR ───────────────────────────────────────────────────
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  // ── Reference data ────────────────────────────────────────
  const [categories, setCategories] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // ── Form ──────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    categoryId: '',
    companyId: '',
    departmentId: '',
    submittedById: '',
    amount: '',
    currency: 'PKR',
    description: '',
    vendor: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    invoiceNumber: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Fetch meta ────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/expenses?meta=true')
      .then((r) => r.json())
      .then((data) => {
        setCategories(data.categories || []);
        setCompanies(data.companies || []);
        setDepartments(data.departments || []);
        setEmployees(data.employees || []);
      })
      .catch(() => {});
  }, []);

  // Release camera on unmount
  useEffect(() => {
    return () => stopCameraStream();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ────────────────────────────────────────────────────────────
  // File handling
  // ────────────────────────────────────────────────────────────
  const acceptFile = (file: File) => {
    setUploadError('');
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPG, PNG, and PDF are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit.');
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview('pdf');
    }
    // Auto-upload → auto-OCR → auto-advance to step 2
    void uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || 'Failed to upload receipt');
      }
      const data = await r.json();
      setReceiptUrl(data.url);
      void runOcr(data.url);
      // advance to details step as soon as receipt is uploaded
      setStep(2);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    acceptFile(file);
  };

  // ────────────────────────────────────────────────────────────
  // Camera
  // ────────────────────────────────────────────────────────────
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
    setUploadError('');
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setUploadError(
        'Camera is not available in this browser. Tap the dashed zone to upload a file instead.'
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
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
        msg = 'Camera permission was denied.';
      } else if (name === 'NotFoundError') {
        msg = 'No camera was found on this device.';
      } else if (name === 'NotReadableError') {
        msg = 'The camera is already in use by another app.';
      }
      if (
        typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        msg += ' Note: Camera access requires HTTPS. Your site is running on HTTP which blocks camera access.';
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

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setCameraError('Camera is still initializing.');
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Failed to capture image.');
          return;
        }
        const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
        closeCamera();
        acceptFile(file);
      },
      'image/jpeg',
      0.92
    );
  };

  // ────────────────────────────────────────────────────────────
  // OCR
  // ────────────────────────────────────────────────────────────
  const runOcr = async (url: string) => {
    setOcrLoading(true);
    setOcrError('');
    setOcrResult(null);
    try {
      const r = await fetch('/api/expenses/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptUrl: url }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || 'OCR failed');
      setOcrResult(body);
      // Auto-apply OCR values to form
      setFormData((prev) => {
        const next = { ...prev };
        if (!next.vendor && body.vendor) next.vendor = body.vendor;
        if (!next.amount && body.amount != null) next.amount = String(body.amount);
        if (body.currency && ['PKR', 'USD', 'AED'].includes(body.currency)) {
          next.currency = body.currency;
        }
        if (body.expenseDate && /^\d{4}-\d{2}-\d{2}$/.test(body.expenseDate)) {
          next.expenseDate = body.expenseDate;
        }
        if (!next.invoiceNumber && body.invoiceNumber) next.invoiceNumber = body.invoiceNumber;
        if (!next.description && body.description) next.description = body.description;
        if (!next.categoryId && body.categorySuggestion) {
          const match = categories.find(
            (c: any) =>
              c.name.toLowerCase() === String(body.categorySuggestion).toLowerCase() ||
              c.name.toLowerCase().includes(String(body.categorySuggestion).toLowerCase())
          );
          if (match) next.categoryId = String(match.id);
        }
        return next;
      });
    } catch (err: any) {
      setOcrError(err?.message || 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────
  // Submit
  // ────────────────────────────────────────────────────────────
  const canSubmit =
    formData.categoryId &&
    formData.companyId &&
    formData.submittedById &&
    formData.amount &&
    formData.description &&
    formData.expenseDate;

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const r = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, receiptUrl: receiptUrl || null }),
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || 'Failed to submit expense');
      }
      const expense = await r.json();
      router.push(`/expenses/${expense.id}`);
    } catch (err: any) {
      setSubmitError(err?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ────────────────────────────────────────────────────────────
  // Render helpers
  // ────────────────────────────────────────────────────────────
  const stepIndicator = (
    <div className="w-full flex items-center justify-center gap-2">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{
            height: 6,
            width: 32,
            borderRadius: 999,
            backgroundColor: n <= step ? TEAL : SURFACE_HIGH,
            transition: 'background-color 200ms',
          }}
        />
      ))}
    </div>
  );

  // ────────────────────────────────────────────────────────────
  // Page shell (sticky header + main + bottom nav)
  // ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: SURFACE,
        color: INK,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Mobile frame container */}
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          marginLeft: 'auto',
          marginRight: 'auto',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          borderLeft: `1px solid ${OUTLINE_VARIANT}20`,
          borderRight: `1px solid ${OUTLINE_VARIANT}20`,
          backgroundColor: SURFACE,
          position: 'relative',
        }}
      >
        {/* Floating ambient blurs (architectural detail) */}
        <div
          style={{
            position: 'absolute',
            top: 80,
            right: -80,
            width: 256,
            height: 256,
            borderRadius: '50%',
            background: `${TEAL}0D`,
            filter: 'blur(60px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 160,
            left: -80,
            width: 192,
            height: 192,
            borderRadius: '50%',
            background: `${NAVY}0D`,
            filter: 'blur(60px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Top nav */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            backgroundColor: `${SURFACE}CC`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (step > 1) setStep((prev) => (prev - 1) as Step);
              else router.back();
            }}
            aria-label="Back"
            style={{
              width: 40,
              height: 40,
              marginRight: 8,
              marginLeft: -8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: INK,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 999,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: NAVY,
              margin: 0,
            }}
          >
            Submit Expense
          </h1>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ color: INK_MUTED, position: 'relative' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: TEAL,
                  border: `2px solid ${SURFACE}`,
                }}
              />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            padding: '32px 24px 112px',
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {stepIndicator}

          {step === 1 && (
            <Step1Capture
              selectedFile={selectedFile}
              preview={preview}
              uploading={uploading}
              uploadError={uploadError}
              fileInputRef={fileInputRef}
              onOpenCamera={openCamera}
              onFileSelect={handleFileSelect}
              ocrLoading={ocrLoading}
            />
          )}

          {step === 2 && (
            <Step2Details
              preview={preview}
              receiptUrl={receiptUrl}
              ocrLoading={ocrLoading}
              ocrResult={ocrResult}
              ocrError={ocrError}
              formData={formData}
              categories={categories}
              companies={companies}
              departments={departments}
              employees={employees}
              onChange={handleChange}
              onNext={() => setStep(3)}
              canAdvance={Boolean(
                formData.categoryId &&
                  formData.companyId &&
                  formData.submittedById &&
                  formData.amount &&
                  formData.description &&
                  formData.expenseDate
              )}
            />
          )}

          {step === 3 && (
            <Step3Review
              preview={preview}
              receiptUrl={receiptUrl}
              formData={formData}
              categories={categories}
              companies={companies}
              departments={departments}
              employees={employees}
              submitting={submitting}
              submitError={submitError}
              canSubmit={Boolean(canSubmit)}
              onSubmit={handleSubmit}
              onEdit={() => setStep(2)}
            />
          )}
        </main>

        {/* Bottom navigation */}
        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 480,
            zIndex: 50,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            height: 64,
            backgroundColor: SURFACE_LOWEST,
            borderTop: `1px solid ${OUTLINE_VARIANT}30`,
            boxShadow: `0 -4px 12px ${NAVY}0A`,
          }}
        >
          <BottomNavItem label="Home" icon="home" />
          <BottomNavItem label="Assets" icon="assets" />
          <BottomNavItem label="Expenses" icon="expenses" active />
          <BottomNavItem label="Inbox" icon="inbox" />
          <BottomNavItem label="Profile" icon="profile" />
        </nav>

        {/* Camera modal */}
        {cameraOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              backgroundColor: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                backgroundColor: SURFACE_LOWEST,
                borderRadius: 16,
                maxWidth: 560,
                width: '100%',
                overflow: 'hidden',
                boxShadow: `0 30px 60px ${NAVY}80`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: `1px solid ${OUTLINE_VARIANT}40`,
                }}
              >
                <h3 style={{ margin: 0, fontWeight: 800, color: NAVY, fontSize: 16 }}>
                  Capture Receipt
                </h3>
                <button
                  type="button"
                  onClick={closeCamera}
                  aria-label="Close camera"
                  style={{
                    border: 'none',
                    background: 'none',
                    color: INK_MUTED,
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ padding: 16 }}>
                {cameraError ? (
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: '#FEF2F2',
                      border: `1px solid ${ROSE}40`,
                      borderRadius: 8,
                      color: ROSE,
                      fontSize: 13,
                    }}
                  >
                    {cameraError}
                  </div>
                ) : (
                  <div
                    style={{
                      position: 'relative',
                      backgroundColor: '#000',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      style={{
                        width: '100%',
                        maxHeight: '60vh',
                        objectFit: 'contain',
                        backgroundColor: '#000',
                      }}
                    />
                    {cameraStarting && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 13,
                        }}
                      >
                        Starting camera…
                      </div>
                    )}
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={closeCamera}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: `1px solid ${OUTLINE_VARIANT}`,
                      backgroundColor: SURFACE_LOWEST,
                      color: INK,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={captureFromCamera}
                    disabled={Boolean(cameraError) || cameraStarting}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: NAVY,
                      color: '#fff',
                      fontWeight: 700,
                      cursor: cameraError || cameraStarting ? 'not-allowed' : 'pointer',
                      opacity: cameraError || cameraStarting ? 0.5 : 1,
                    }}
                  >
                    Capture Photo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 1 — Capture Receipt
// ─────────────────────────────────────────────────────────────
function Step1Capture({
  selectedFile,
  preview,
  uploading,
  uploadError,
  fileInputRef,
  onOpenCamera,
  onFileSelect,
  ocrLoading,
}: {
  selectedFile: File | null;
  preview: string | null;
  uploading: boolean;
  uploadError: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onOpenCamera: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ocrLoading: boolean;
}) {
  const isBusy = uploading || ocrLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
      {/* Heading */}
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            color: INK,
            margin: 0,
          }}
        >
          Capture Receipt
        </h2>
        <p style={{ marginTop: 8, fontSize: 13, fontWeight: 500, color: INK_MUTED }}>
          Position your receipt within the frame for automatic scanning.
        </p>
      </div>

      {/* Huge camera button */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: -16,
            background: `${TEAL}0D`,
            borderRadius: '50%',
            filter: 'blur(32px)',
            pointerEvents: 'none',
          }}
        />
        <button
          type="button"
          onClick={onOpenCamera}
          disabled={isBusy}
          style={{
            position: 'relative',
            width: 192,
            height: 192,
            borderRadius: '50%',
            backgroundColor: NAVY,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: `4px solid ${SURFACE_LOWEST}`,
            boxShadow: `0 20px 50px ${NAVY}60`,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.6 : 1,
            transition: 'transform 150ms',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="#fff">
            <path d="M9 3L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.17L15 3H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
            <circle cx="12" cy="13" r="3.2" fill={NAVY} />
          </svg>
          <span
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontFamily: MONO,
              fontSize: 10,
              marginTop: 8,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            {isBusy ? 'Processing' : 'Shutter'}
          </span>
        </button>
      </div>

      {/* Upload zone */}
      <div style={{ width: '100%', maxWidth: 320 }}>
        <label
          htmlFor="receipt-file"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: 160,
            border: `2px dashed ${OUTLINE_VARIANT}`,
            borderRadius: 12,
            backgroundColor: SURFACE_LOW,
            cursor: isBusy ? 'not-allowed' : 'pointer',
            transition: 'background-color 150ms',
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={INK_MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ fontSize: 12, color: INK_MUTED, fontWeight: 500, letterSpacing: '0.02em', margin: 0 }}>
              or tap to upload an image
            </p>
            <p
              style={{
                marginTop: 4,
                fontSize: 10,
                color: OUTLINE,
                textTransform: 'uppercase',
                fontFamily: MONO,
                letterSpacing: '-0.01em',
              }}
            >
              JPG, PNG, PDF up to 10MB
            </p>
          </div>
          <input
            id="receipt-file"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,application/pdf"
            onChange={onFileSelect}
            disabled={isBusy}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Progress / status */}
      {isBusy && (
        <div
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            backgroundColor: TEAL_TINT,
            border: `1px solid ${TEAL}30`,
            color: TEAL_DEEP,
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Spinner color={TEAL_DEEP} />
          {uploading ? 'Uploading receipt…' : 'Scanning receipt with AI…'}
        </div>
      )}

      {uploadError && (
        <div
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            backgroundColor: '#FEF2F2',
            border: `1px solid ${ROSE}40`,
            color: ROSE,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {uploadError}
        </div>
      )}

      {/* Pro Tip card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          backgroundColor: SURFACE_LOWEST,
          padding: 16,
          borderRadius: 12,
          border: `1px solid ${OUTLINE_VARIANT}25`,
          width: '100%',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
        <p style={{ fontSize: 11, color: INK_MUTED, lineHeight: 1.6, margin: 0 }}>
          <span style={{ fontWeight: 700, color: INK }}>Pro Tip:</span> Ensure the lighting is bright
          and the text is sharp to speed up OCR verification.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2 — Details
// ─────────────────────────────────────────────────────────────
function Step2Details({
  preview,
  receiptUrl,
  ocrLoading,
  ocrResult,
  ocrError,
  formData,
  categories,
  companies,
  departments,
  employees,
  onChange,
  onNext,
  canAdvance,
}: {
  preview: string | null;
  receiptUrl: string | null;
  ocrLoading: boolean;
  ocrResult: OcrResult | null;
  ocrError: string;
  formData: any;
  categories: any[];
  companies: any[];
  departments: any[];
  employees: any[];
  onChange: (e: React.ChangeEvent<any>) => void;
  onNext: () => void;
  canAdvance: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: INK,
            margin: 0,
          }}
        >
          Expense Details
        </h2>
        <p style={{ marginTop: 8, fontSize: 13, color: INK_MUTED, fontWeight: 500 }}>
          We've pre-filled what we detected. Review and adjust as needed.
        </p>
      </div>

      {/* Receipt thumbnail strip */}
      {(preview || receiptUrl) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            backgroundColor: SURFACE_LOWEST,
            border: `1px solid ${OUTLINE_VARIANT}30`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              backgroundColor: SURFACE_LOW,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {preview && preview !== 'pdf' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Receipt"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: MONO,
                letterSpacing: '0.1em',
                color: OUTLINE,
                textTransform: 'uppercase',
              }}
            >
              {ocrLoading ? 'AI Scan in progress' : ocrError ? 'AI Scan unavailable' : 'Receipt attached'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginTop: 2 }}>
              {ocrLoading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Spinner color={NAVY} />
                  Extracting fields…
                </span>
              ) : ocrResult ? (
                <>
                  Confidence:{' '}
                  <span
                    style={{
                      color:
                        ocrResult.confidence === 'high'
                          ? TEAL_DEEP
                          : ocrResult.confidence === 'medium'
                          ? AMBER
                          : ROSE,
                      textTransform: 'capitalize',
                    }}
                  >
                    {ocrResult.confidence}
                  </span>
                </>
              ) : (
                'Fill fields manually below'
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FieldSelect
          label="Category"
          name="categoryId"
          value={formData.categoryId}
          onChange={onChange}
          required
          options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          placeholder="Select category"
        />

        <FieldSelect
          label="Company"
          name="companyId"
          value={formData.companyId}
          onChange={onChange}
          required
          options={companies.map((c) => ({
            value: String(c.id),
            label: `${c.code || c.name} — ${c.name}`,
          }))}
          placeholder="Select sub-company"
        />

        <FieldSelect
          label="Department"
          name="departmentId"
          value={formData.departmentId}
          onChange={onChange}
          options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
          placeholder="Select department"
        />

        <FieldSelect
          label="Submitted By"
          name="submittedById"
          value={formData.submittedById}
          onChange={onChange}
          required
          options={employees.map((e) => ({
            value: String(e.id),
            label: `${e.firstName} ${e.lastName} (${e.empCode})`,
          }))}
          placeholder="Select employee"
        />

        {/* Amount + currency row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <FieldInput
            label="Amount"
            name="amount"
            type="number"
            required
            step="0.01"
            value={formData.amount}
            onChange={onChange}
            placeholder="0.00"
            mono
          />
          <FieldSelect
            label="Currency"
            name="currency"
            value={formData.currency}
            onChange={onChange}
            options={[
              { value: 'PKR', label: 'PKR' },
              { value: 'USD', label: 'USD' },
              { value: 'AED', label: 'AED' },
            ]}
          />
        </div>

        <FieldInput
          label="Vendor"
          name="vendor"
          value={formData.vendor}
          onChange={onChange}
          placeholder="Vendor name"
        />

        <FieldInput
          label="Expense Date"
          name="expenseDate"
          type="date"
          required
          value={formData.expenseDate}
          onChange={onChange}
        />

        <FieldInput
          label="Invoice Number"
          name="invoiceNumber"
          value={formData.invoiceNumber}
          onChange={onChange}
          placeholder="INV-XXXX"
        />

        <FieldSelect
          label="Payment Method"
          name="paymentMethod"
          value={formData.paymentMethod}
          onChange={onChange}
          options={[
            { value: 'CASH', label: 'Cash' },
            { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
            { value: 'CREDIT_CARD', label: 'Credit Card' },
            { value: 'PETTY_CASH', label: 'Petty Cash' },
          ]}
          placeholder="Select method"
        />

        <FieldTextarea
          label="Description"
          name="description"
          required
          value={formData.description}
          onChange={onChange}
          placeholder="Describe the expense…"
          rows={3}
        />
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canAdvance}
        style={{
          marginTop: 8,
          height: 52,
          borderRadius: 12,
          border: 'none',
          backgroundColor: canAdvance ? NAVY : OUTLINE_VARIANT,
          color: '#fff',
          fontWeight: 700,
          letterSpacing: '0.02em',
          fontSize: 14,
          cursor: canAdvance ? 'pointer' : 'not-allowed',
          textTransform: 'uppercase',
          transition: 'background-color 150ms',
        }}
        onMouseEnter={(e) => {
          if (canAdvance) e.currentTarget.style.backgroundColor = NAVY_HOVER;
        }}
        onMouseLeave={(e) => {
          if (canAdvance) e.currentTarget.style.backgroundColor = NAVY;
        }}
      >
        Continue to Review →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 3 — Review & Submit
// ─────────────────────────────────────────────────────────────
function Step3Review({
  preview,
  receiptUrl,
  formData,
  categories,
  companies,
  departments,
  employees,
  submitting,
  submitError,
  canSubmit,
  onSubmit,
  onEdit,
}: {
  preview: string | null;
  receiptUrl: string | null;
  formData: any;
  categories: any[];
  companies: any[];
  departments: any[];
  employees: any[];
  submitting: boolean;
  submitError: string;
  canSubmit: boolean;
  onSubmit: () => void;
  onEdit: () => void;
}) {
  const category = categories.find((c) => String(c.id) === String(formData.categoryId));
  const company = companies.find((c) => String(c.id) === String(formData.companyId));
  const department = departments.find((d) => String(d.id) === String(formData.departmentId));
  const employee = employees.find((e) => String(e.id) === String(formData.submittedById));

  const row = (label: string, value: React.ReactNode, mono = false) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        padding: '12px 0',
        borderBottom: `1px solid ${SURFACE_LOW}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: OUTLINE,
          fontFamily: MONO,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: INK,
          fontWeight: 600,
          textAlign: 'right',
          fontFamily: mono ? MONO : undefined,
        }}
      >
        {value || <span style={{ color: OUTLINE_VARIANT }}>—</span>}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: INK,
            margin: 0,
          }}
        >
          Review &amp; Submit
        </h2>
        <p style={{ marginTop: 8, fontSize: 13, color: INK_MUTED, fontWeight: 500 }}>
          Verify everything looks right before sending for approval.
        </p>
      </div>

      {/* Hero: amount + category */}
      <div
        style={{
          position: 'relative',
          padding: 24,
          borderRadius: 16,
          backgroundColor: NAVY,
          color: '#fff',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 16,
            bottom: 16,
            width: 2,
            backgroundColor: TEAL,
          }}
        />
        <div style={{ paddingLeft: 12 }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.6)',
              fontFamily: MONO,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            Total
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              fontFamily: MONO,
              letterSpacing: '-0.02em',
              marginTop: 4,
              lineHeight: 1,
            }}
          >
            {formData.currency}{' '}
            {Number(formData.amount || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.1)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: TEAL,
              }}
            />
            {category?.name || 'Uncategorized'}
          </div>
        </div>
      </div>

      {/* Details card */}
      <div
        style={{
          backgroundColor: SURFACE_LOWEST,
          borderRadius: 16,
          padding: '4px 20px',
          border: `1px solid ${OUTLINE_VARIANT}25`,
        }}
      >
        {row('Vendor', formData.vendor)}
        {row('Date', formData.expenseDate, true)}
        {row('Company', company ? `${company.code || ''} ${company.name}`.trim() : null)}
        {row('Department', department?.name)}
        {row(
          'Submitted By',
          employee ? `${employee.firstName} ${employee.lastName}` : null
        )}
        {row('Payment', formData.paymentMethod?.replace(/_/g, ' '))}
        {row('Invoice', formData.invoiceNumber, true)}
        <div style={{ padding: '12px 0' }}>
          <div
            style={{
              fontSize: 10,
              color: OUTLINE,
              fontFamily: MONO,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            Description
          </div>
          <div style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>
            {formData.description || <span style={{ color: OUTLINE_VARIANT }}>—</span>}
          </div>
        </div>
      </div>

      {/* Receipt preview */}
      {preview && preview !== 'pdf' && (
        <div
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            border: `1px solid ${OUTLINE_VARIANT}30`,
            backgroundColor: SURFACE_LOWEST,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Receipt"
            style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}

      {submitError && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: '#FEF2F2',
            color: ROSE,
            fontSize: 12,
            fontWeight: 500,
            border: `1px solid ${ROSE}40`,
          }}
        >
          {submitError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          style={{
            height: 52,
            borderRadius: 12,
            border: 'none',
            backgroundColor: canSubmit && !submitting ? NAVY : OUTLINE_VARIANT,
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {submitting ? (
            <>
              <Spinner color="#fff" />
              Submitting…
            </>
          ) : (
            <>Submit for Approval →</>
          )}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={submitting}
          style={{
            height: 48,
            borderRadius: 12,
            border: `1px solid ${OUTLINE_VARIANT}`,
            backgroundColor: SURFACE_LOWEST,
            color: INK,
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          ← Edit Details
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Form field primitives — bottom-border-only, teal focus accent
// ─────────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontFamily: MONO,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: OUTLINE,
        marginBottom: 8,
      }}
    >
      {children}
      {required && <span style={{ color: TEAL, marginLeft: 4 }}>*</span>}
    </div>
  );
}

function FieldInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  step,
  mono,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  step?: string;
  mono?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        name={name}
        type={type}
        step={step}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: '12px 0',
          backgroundColor: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${focused ? TEAL : OUTLINE_VARIANT}`,
          outline: 'none',
          fontSize: 15,
          fontWeight: 500,
          color: INK,
          fontFamily: mono ? MONO : 'inherit',
          transition: 'border-color 150ms',
        }}
      />
    </div>
  );
}

function FieldSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div style={{ position: 'relative' }}>
        <select
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          style={{
            width: '100%',
            padding: '12px 28px 12px 0',
            appearance: 'none',
            WebkitAppearance: 'none',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${focused ? TEAL : OUTLINE_VARIANT}`,
            outline: 'none',
            fontSize: 15,
            fontWeight: 500,
            color: value ? INK : OUTLINE,
            cursor: 'pointer',
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={focused ? TEAL : OUTLINE}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

function FieldTextarea({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        style={{
          width: '100%',
          padding: '12px 0',
          backgroundColor: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${focused ? TEAL : OUTLINE_VARIANT}`,
          outline: 'none',
          fontSize: 15,
          fontWeight: 500,
          color: INK,
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          transition: 'border-color 150ms',
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom nav item
// ─────────────────────────────────────────────────────────────
function BottomNavItem({
  label,
  icon,
  active,
}: {
  label: string;
  icon: 'home' | 'assets' | 'expenses' | 'inbox' | 'profile';
  active?: boolean;
}) {
  const color = active ? TEAL : '#94A3B8';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        fontSize: 10,
        fontWeight: active ? 700 : 500,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        gap: 2,
      }}
    >
      <NavIcon name={icon} active={!!active} color={color} />
      <span>{label}</span>
      {active && (
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: 999,
            backgroundColor: TEAL,
            marginTop: 1,
          }}
        />
      )}
    </div>
  );
}

function NavIcon({
  name,
  active,
  color,
}: {
  name: 'home' | 'assets' | 'expenses' | 'inbox' | 'profile';
  active: boolean;
  color: string;
}) {
  const stroke = color;
  const fill = active ? color : 'none';
  switch (name) {
    case 'home':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'assets':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case 'expenses':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case 'inbox':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case 'profile':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

// ─────────────────────────────────────────────────────────────
// Small shared
// ─────────────────────────────────────────────────────────────
function Spinner({ color = TEAL }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'ledger-spin 900ms linear infinite' }}>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="50 50"
      />
      <style>{`@keyframes ledger-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
