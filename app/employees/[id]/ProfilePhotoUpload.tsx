'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Cropper, { type Area } from 'react-easy-crop';

interface ProfilePhotoUploadProps {
  employeeId: number;
  photoUrl: string | null;
  initials: string;
}

const OUTPUT_SIZE = 400; // Every saved profile photo is 400x400 JPEG.

export default function ProfilePhotoUpload({
  employeeId,
  photoUrl,
  initials,
}: ProfilePhotoUploadProps) {
  const [currentPhoto, setCurrentPhoto] = useState(photoUrl);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null); // data URL during crop
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      alert('Only JPG and PNG images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeCrop = () => {
    setImgSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const saveCroppedPhoto = async () => {
    if (!imgSrc || !croppedAreaPixels) return;
    setBusy('upload');
    try {
      const blob = await renderCroppedJpeg(imgSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append('file', blob, 'profile.jpg');

      const res = await fetch(`/api/employees/${employeeId}/photo`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const data = await res.json();
      setCurrentPhoto(data.photoUrl);
      closeCrop();
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to upload photo');
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async () => {
    if (!currentPhoto) return;
    if (!window.confirm('Remove this profile photo?')) return;
    setBusy('remove');
    try {
      const res = await fetch(`/api/employees/${employeeId}/photo`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Remove failed');
      }
      setCurrentPhoto(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to remove photo');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="relative w-20 h-20 flex-shrink-0">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative w-20 h-20 rounded-full cursor-pointer group overflow-hidden"
          title={currentPhoto ? 'Click to replace photo' : 'Click to upload photo'}
          style={{ border: '2px solid rgba(20,184,166,0.3)' }}
        >
          {currentPhoto ? (
            <img
              src={currentPhoto}
              alt="Profile"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{ background: 'rgba(20,184,166,0.15)' }}
            >
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#8FBF3F' }}>
                {initials}
              </span>
            </div>
          )}

          {/* Hover camera icon */}
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            {busy === 'upload' ? (
              <Spinner />
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Remove × — only shown when a photo is set */}
        {currentPhoto && (
          <button
            type="button"
            onClick={removePhoto}
            disabled={busy === 'remove'}
            title="Remove photo"
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-core-surface text-core-text2 ring-1 ring-core-border shadow-sm hover:text-core-roseFg hover:ring-rose-300 transition disabled:opacity-50"
          >
            {busy === 'remove' ? (
              <span className="inline-flex items-center justify-center w-full h-full">
                <Spinner small />
              </span>
            ) : (
              <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {imgSrc && (
        <CropModal
          imgSrc={imgSrc}
          crop={crop}
          zoom={zoom}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          onCancel={closeCrop}
          onSave={saveCroppedPhoto}
          saving={busy === 'upload'}
          canSave={!!croppedAreaPixels}
        />
      )}
    </>
  );
}

function CropModal(props: {
  imgSrc: string;
  crop: { x: number; y: number };
  zoom: number;
  onCropChange: (c: { x: number; y: number }) => void;
  onZoomChange: (z: number) => void;
  onCropComplete: (a: Area, p: Area) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div className="bg-core-surface rounded-xl shadow-xl w-[min(420px,92vw)] overflow-hidden">
        <div className="px-5 py-3 border-b border-core-border flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-core-text">Adjust profile photo</h3>
          <button
            onClick={props.onCancel}
            className="text-core-text3 hover:text-core-text2"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative w-full" style={{ height: 320, background: '#0a0a0a' }}>
          <Cropper
            image={props.imgSrc}
            crop={props.crop}
            zoom={props.zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={props.onCropChange}
            onZoomChange={props.onZoomChange}
            onCropComplete={props.onCropComplete}
          />
        </div>

        <div className="px-5 py-3 flex items-center gap-3">
          <span className="text-[12px] text-core-text3 w-10">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={props.zoom}
            onChange={(e) => props.onZoomChange(Number(e.target.value))}
            className="flex-1 accent-core-text"
          />
        </div>

        <div className="px-5 py-3 border-t border-core-border flex items-center justify-end gap-2 bg-core-surface2">
          <button
            type="button"
            onClick={props.onCancel}
            disabled={props.saving}
            className="px-4 py-1.5 rounded-md text-[13px] font-medium text-core-text2 hover:bg-core-surface ring-1 ring-core-border"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onSave}
            disabled={props.saving || !props.canSave}
            className="px-4 py-1.5 rounded-md text-[13px] font-medium bg-core-green text-white hover:bg-core-green disabled:bg-core-border disabled:cursor-not-allowed"
          >
            {props.saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? 12 : 24;
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.25 }} />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity: 0.85 }} />
    </svg>
  );
}

/**
 * Render the cropped region of the source image into a 400x400 canvas and
 * return a JPEG blob. Quality is 0.92 — visually indistinguishable from the
 * original at avatar size while keeping uploads under ~80KB for typical photos.
 */
async function renderCroppedJpeg(imgSrc: string, area: Area): Promise<Blob> {
  const img = await loadImage(imgSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
      'image/jpeg',
      0.92,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}
