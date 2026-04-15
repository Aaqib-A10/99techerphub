'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface ProfilePhotoUploadProps {
  employeeId: number;
  photoUrl: string | null;
  initials: string;
}

export default function ProfilePhotoUpload({ employeeId, photoUrl, initials }: ProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(photoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/employees/${employeeId}/photo`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();
      setCurrentPhoto(data.photoUrl);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-20 h-20 rounded-full flex-shrink-0 cursor-pointer group"
      title="Click to upload profile photo"
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
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#14B8A6' }}>
            {initials}
          </span>
        </div>
      )}

      {/* Hover overlay */}
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        {uploading ? (
          <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
