'use client';

import { useRouter } from 'next/navigation';

const NAVY = '#0B1F3A';
const TEAL = '#14B8A6';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #152B4C 100%)`,
      }}
    >
      {/* Ambient teal glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -120,
          right: -120,
          width: 360,
          height: 360,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(20,184,166,0.2) 0%, rgba(20,184,166,0) 65%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -120,
          left: -120,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(244,63,94,0.14) 0%, rgba(244,63,94,0) 65%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="w-full max-w-md relative z-10 p-8 rounded-2xl text-center"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Ledger line accent */}
        <div
          aria-hidden
          style={{
            height: 2,
            width: 48,
            background: TEAL,
            margin: '0 auto 24px',
          }}
        />

        {/* Icon */}
        <div className="mb-6">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full"
            style={{
              background: 'rgba(244,63,94,0.12)',
              border: '1px solid rgba(244,63,94,0.3)',
            }}
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="#F43F5E"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div
          className="eyebrow"
          style={{
            color: TEAL,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          System / Access Control
        </div>
        <h1
          style={{
            fontSize: '1.875rem',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            marginBottom: 12,
          }}
        >
          Access Denied
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 24 }}>
          You don&apos;t have permission to access this page. Your role may not
          have the required privileges.
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-center mb-6">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 font-bold rounded-lg transition-all"
            style={{
              background: TEAL,
              color: NAVY,
              boxShadow: '0 4px 12px -4px rgba(20,184,166,0.5)',
            }}
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 font-bold rounded-lg transition-all"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            Go Back
          </button>
        </div>

        {/* Help Text */}
        <div
          className="p-4 rounded-lg"
          style={{
            background: 'rgba(20,184,166,0.08)',
            border: '1px solid rgba(20,184,166,0.2)',
          }}
        >
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
            If you believe this is an error, please contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
