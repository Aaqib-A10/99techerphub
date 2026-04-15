'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PageHero from '@/app/components/PageHero';

export default function NewExpensePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraStarting, setCameraStarting] = useState(false);

  // OCR state — powered by Claude vision via /api/expenses/ocr
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrResult, setOcrResult] = useState<null | {
    vendor: string | null;
    amount: number | null;
    currency: string | null;
    expenseDate: string | null;
    invoiceNumber: string | null;
    description: string | null;
    categorySuggestion: string | null;
    confidence: string;
  }>(null);

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

  useEffect(() => {
    fetch('/api/expenses?meta=true')
      .then((r) => r.json())
      .then((data) => {
        setCategories(data.categories || []);
        setCompanies(data.companies || []);
        setEmployees(data.employees || []);
        setDepartments(data.departments || []);
      });
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const acceptFile = (file: File) => {
    setUploadError('');
    setSelectedFile(file);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPG, PNG, and PDF are allowed.');
      setSelectedFile(null);
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('File size exceeds 5MB limit');
      setSelectedFile(null);
      return;
    }

    // Show preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      // For PDFs, show a placeholder
      setPreview('pdf');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    acceptFile(file);
  };

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
        'Camera is not available in this browser. Please use "Select from Gallery" instead.'
      );
      return;
    }
    setCameraOpen(true);
    setCameraStarting(true);
    try {
      // Prefer the rear camera on phones; fall back to any camera on laptops.
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
          'Camera permission was denied. Please allow camera access in your browser settings and try again.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No camera was found on this device.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        msg = 'The camera is already in use by another application.';
      } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        msg =
          'Camera access requires HTTPS. Please open this page over HTTPS (or use localhost) and try again.';
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
        const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
        acceptFile(file);
        closeCamera();
      },
      'image/jpeg',
      0.92
    );
  };

  // Make sure camera stream is released if the component unmounts while open
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const handleUploadFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', selectedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload file');
      }

      const data = await response.json();
      setReceiptUrl(data.url);
      setSelectedFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Automatically run OCR against the newly uploaded receipt.
      // Ignore any error from the OCR step — the user can still fill the form manually.
      void runOcrForUrl(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  /**
   * Call /api/expenses/ocr with a receipt URL, store the result in state.
   * Does not auto-apply to the form — the user clicks "Apply to Form" to fill fields.
   */
  const runOcrForUrl = async (url: string) => {
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
      if (!r.ok) {
        throw new Error(body?.error || 'OCR failed');
      }
      setOcrResult(body);
    } catch (err: any) {
      setOcrError(err?.message || 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRescanReceipt = () => {
    if (receiptUrl) void runOcrForUrl(receiptUrl);
  };

  /**
   * Apply the OCR result to the expense form.
   * Only overwrites fields that are currently empty so user edits are preserved.
   */
  const applyOcrToForm = () => {
    if (!ocrResult) return;
    setFormData((prev) => {
      const next = { ...prev };
      if (!next.vendor && ocrResult.vendor) next.vendor = ocrResult.vendor;
      if (!next.amount && ocrResult.amount != null) next.amount = String(ocrResult.amount);
      if (ocrResult.currency && ['PKR', 'USD', 'AED'].includes(ocrResult.currency)) {
        next.currency = ocrResult.currency;
      }
      if (ocrResult.expenseDate) {
        // Validate format yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(ocrResult.expenseDate)) {
          next.expenseDate = ocrResult.expenseDate;
        }
      }
      if (!next.invoiceNumber && ocrResult.invoiceNumber) next.invoiceNumber = ocrResult.invoiceNumber;
      if (!next.description && ocrResult.description) next.description = ocrResult.description;

      // Try to match categorySuggestion to an existing category by name
      if (!next.categoryId && ocrResult.categorySuggestion) {
        const match = categories.find(
          (c: any) =>
            c.name.toLowerCase() === ocrResult.categorySuggestion!.toLowerCase() ||
            c.name.toLowerCase().includes(ocrResult.categorySuggestion!.toLowerCase())
        );
        if (match) next.categoryId = String(match.id);
      }

      return next;
    });
  };

  const handleRemoveReceipt = () => {
    setReceiptUrl(null);
    setSelectedFile(null);
    setPreview(null);
    setOcrResult(null);
    setOcrError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          receiptUrl: receiptUrl || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit expense');
      }

      const expense = await response.json();
      router.push(`/expenses/${expense.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHero
        eyebrow="Finance / Expense Vault"
        title="Submit New Expense"
        description="Submit an expense for approval"
      />

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Expense Details</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Category *</label>
                <select name="categoryId" value={formData.categoryId} onChange={handleChange} required className="form-select">
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Company *</label>
                <select name="companyId" value={formData.companyId} onChange={handleChange} required className="form-select">
                  <option value="">Select Company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Department</label>
                <select name="departmentId" value={formData.departmentId} onChange={handleChange} className="form-select">
                  <option value="">Select Department</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Submitted By *</label>
                <select name="submittedById" value={formData.submittedById} onChange={handleChange} required className="form-select">
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empCode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Amount *</label>
                <input name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} required className="form-input" placeholder="0.00" />
              </div>
              <div>
                <label className="form-label">Currency</label>
                <select name="currency" value={formData.currency} onChange={handleChange} className="form-select">
                  <option value="PKR">PKR</option>
                  <option value="USD">USD</option>
                  <option value="AED">AED</option>
                </select>
              </div>
              <div>
                <label className="form-label">Expense Date *</label>
                <input name="expenseDate" type="date" value={formData.expenseDate} onChange={handleChange} required className="form-input" />
              </div>
              <div>
                <label className="form-label">Payment Method</label>
                <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="form-select">
                  <option value="">Select Method</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="PETTY_CASH">Petty Cash</option>
                </select>
              </div>
              <div>
                <label className="form-label">Invoice / Receipt Number</label>
                <input name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} className="form-input" placeholder="INV-XXXX" />
              </div>
              <div>
                <label className="form-label">Vendor</label>
                <input name="vendor" value={formData.vendor} onChange={handleChange} className="form-input" placeholder="Vendor name" />
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Description *</label>
                <textarea name="description" value={formData.description} onChange={handleChange} required rows={3} className="form-textarea" placeholder="Describe the expense..." />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Receipt Upload</h2>
          </div>
          <div className="card-body">
            {uploadError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {uploadError}
              </div>
            )}

            {receiptUrl ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Receipt uploaded successfully</span>
                  </div>
                  <p className="text-sm text-green-700 mb-3">{selectedFile?.name || 'Receipt file'}</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleRemoveReceipt}
                      className="text-sm text-green-600 hover:text-green-800 font-medium"
                    >
                      Remove and upload different file
                    </button>
                    <button
                      type="button"
                      onClick={handleRescanReceipt}
                      disabled={ocrLoading}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {ocrLoading ? 'Scanning...' : 'Re-scan with AI'}
                    </button>
                  </div>
                </div>

                {/* OCR result panel */}
                {ocrLoading && !ocrResult && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-3">
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="10" strokeWidth="3" strokeLinecap="round" strokeDasharray="50 50" />
                    </svg>
                    Scanning receipt with AI... this takes a few seconds.
                  </div>
                )}

                {ocrError && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded text-sm text-amber-800">
                    <div className="font-medium">AI scan failed</div>
                    <div className="text-xs mt-1">{ocrError}</div>
                    <div className="text-xs mt-1 text-amber-700">
                      You can still fill in the fields manually below.
                    </div>
                  </div>
                )}

                {ocrResult && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-blue-900">
                          AI-extracted receipt details
                        </div>
                        <div className="text-xs text-blue-700">
                          Confidence: <span className="font-medium">{ocrResult.confidence}</span>{' '}
                          &middot; Review before applying
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={applyOcrToForm}
                        className="btn btn-primary text-sm"
                      >
                        Apply to Form
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-blue-600 uppercase tracking-wide">Vendor</div>
                        <div className="text-blue-900 font-medium">
                          {ocrResult.vendor || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-blue-600 uppercase tracking-wide">Amount</div>
                        <div className="text-blue-900 font-medium">
                          {ocrResult.amount != null
                            ? `${ocrResult.currency || ''} ${Number(ocrResult.amount).toLocaleString()}`.trim()
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-blue-600 uppercase tracking-wide">Date</div>
                        <div className="text-blue-900 font-medium">
                          {ocrResult.expenseDate || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-blue-600 uppercase tracking-wide">Invoice #</div>
                        <div className="text-blue-900 font-medium">
                          {ocrResult.invoiceNumber || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-blue-600 uppercase tracking-wide">Category</div>
                        <div className="text-blue-900 font-medium">
                          {ocrResult.categorySuggestion || '—'}
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-3">
                        <div className="text-blue-600 uppercase tracking-wide">Description</div>
                        <div className="text-blue-900 font-medium">
                          {ocrResult.description || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedFile && preview ? (
              <div className="space-y-4">
                {preview === 'pdf' ? (
                  <div className="p-8 bg-gray-100 rounded-lg border border-gray-300 text-center">
                    <svg className="mx-auto h-12 w-12 text-red-500 mb-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">PDF Document</p>
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-lg border border-gray-300 overflow-hidden p-4">
                    <img
                      src={preview}
                      alt="Receipt preview"
                      className="w-full h-auto max-h-64 object-contain rounded"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleUploadFile}
                    disabled={uploading}
                    className="flex-1 btn btn-primary"
                  >
                    {uploading ? 'Uploading...' : 'Upload Receipt'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-4 text-sm text-gray-600">
                  Take a photo or choose a receipt from your device
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Supports JPG, PNG, PDF up to 5MB
                </p>
                {/* Hidden input for gallery / file picker */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    type="button"
                    onClick={openCamera}
                    className="btn btn-primary inline-flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Upload via Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-secondary inline-flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Select from Gallery
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Submitting...' : 'Submit Expense'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </form>

      {/* Camera modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-bold text-gray-900">Capture Receipt</h3>
              <button
                type="button"
                onClick={closeCamera}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close camera"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {cameraError ? (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">
                  {cameraError}
                </div>
              ) : (
                <div className="relative bg-black rounded overflow-hidden">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full max-h-[60vh] object-contain bg-black"
                  />
                  {cameraStarting && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                      Starting camera...
                    </div>
                  )}
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
              <div className="mt-4 flex gap-2 justify-end">
                <button type="button" onClick={closeCamera} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={captureFromCamera}
                  disabled={!!cameraError || cameraStarting}
                  className="btn btn-primary"
                >
                  Capture Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
