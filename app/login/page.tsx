'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 99 Hub ERP — Login
// Architectural Ledger design — navy left panel + editorial white card.
// NOTE: Uses Tailwind arbitrary-value syntax (bg-[#0B1F3A], etc.) so it renders
// correctly regardless of whether the dev server has picked up the custom
// `ledger-*` theme tokens from tailwind.config.ts.

type Region = 'Eagan' | 'Dubai' | 'Islamabad';

const REGION_TZ: Record<Region, string> = {
  Eagan: 'CST / UTC−6',
  Dubai: 'GST / UTC+4',
  Islamabad: 'PKT / UTC+5',
};

// Architectural Ledger palette
const NAVY = '#0B1F3A';
const NAVY_HOVER = '#152B4C';
const TEAL = '#14B8A6';
const TEAL_DEEP = '#006B5F';
const SURFACE = '#F8F9FF';
const SURFACE_LOW = '#EFF4FF';
const INK = '#0B1C30';
const INK_MUTED = '#44474D';
const OUTLINE = '#75777E';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [region, setRegion] = useState<Region>('Eagan');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Invalid credentials');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: SURFACE, color: INK }}
    >
      {/* Thin teal rule at the very top — "Architectural" signature */}
      <div
        className="fixed top-0 left-0 w-full z-50"
        style={{ height: '3px', backgroundColor: TEAL, opacity: 0.6 }}
      />

      {/* ========== LEFT PANEL — Navy brand panel (40%) ========== */}
      <section
        className="hidden lg:flex lg:w-[40%] relative flex-col justify-between p-16 overflow-hidden"
        style={{ backgroundColor: NAVY }}
      >
        {/* Vertical "Ledger Line" signature accent */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2"
          style={{ height: '8rem', width: '2px', backgroundColor: TEAL }}
        />

        {/* Brand block — text-only wordmark, no icon badge */}
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white tracking-tighter mb-5 leading-none">
            99 Hub ERP
          </h1>
          <p
            className="text-base max-w-xs font-medium leading-relaxed"
            style={{ color: 'rgba(255, 255, 255, 0.55)' }}
          >
            One source of truth for every asset,
            <br />
            expense, and employee
          </p>
        </div>

        {/* World map — dot-grid continents with particle glow */}
        <div className="relative flex-1 flex items-center justify-center my-12">
          <div
            className="relative w-full max-w-md aspect-square rounded-sm overflow-hidden"
            style={{
              backgroundColor: 'rgba(13, 27, 48, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              boxShadow:
                'inset 0 0 120px rgba(20, 184, 166, 0.05), inset 0 0 40px rgba(11, 31, 58, 0.8)',
            }}
          >
            {/* Radial glow behind the globe */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 55% 48%, rgba(20,184,166,0.08) 0%, rgba(11,31,58,0) 55%)',
              }}
            />

            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1000 1000"
              fill="none"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Dot pattern used to fill continent shapes */}
                <pattern
                  id="continent-dots"
                  x="0"
                  y="0"
                  width="9"
                  height="9"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1.6" cy="1.6" r="1.4" fill="rgba(255,255,255,0.38)" />
                </pattern>

                {/* Soft glow filter for arcs + particles */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Strong glow filter for bright particles */}
                <filter id="glow-strong" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Clip path: continent silhouettes (recognizable shapes) */}
                <clipPath id="continents-clip">
                  {/* Alaska */}
                  <path d="M 60,140 L 110,125 L 130,135 L 125,155 L 95,165 L 65,160 Z" />
                  {/* North America main */}
                  <path d="M 130,115 L 175,95 L 220,88 L 265,92 L 310,100 L 340,112 L 355,128 L 350,150 L 345,175 L 335,200 L 320,225 L 300,245 L 280,258 L 258,268 L 238,272 L 218,268 L 200,255 L 182,238 L 168,218 L 152,195 L 140,170 L 130,145 L 125,125 Z" />
                  {/* Central America */}
                  <path d="M 255,275 L 275,282 L 288,300 L 295,322 L 285,335 L 268,328 L 255,310 L 248,290 Z" />
                  {/* South America */}
                  <path d="M 285,340 L 315,335 L 340,350 L 352,378 L 355,410 L 348,445 L 332,480 L 310,505 L 290,515 L 275,500 L 268,470 L 270,435 L 278,400 L 282,370 Z" />
                  {/* Greenland */}
                  <path d="M 395,65 L 435,55 L 475,65 L 485,90 L 475,115 L 445,125 L 410,118 L 395,100 L 388,82 Z" />
                  {/* Iceland */}
                  <path d="M 465,140 L 480,135 L 490,145 L 485,155 L 470,155 Z" />
                  {/* Europe */}
                  <path d="M 495,135 L 525,125 L 555,130 L 580,140 L 600,150 L 605,168 L 595,185 L 575,192 L 550,192 L 525,188 L 505,178 L 495,160 Z" />
                  {/* UK/Ireland */}
                  <path d="M 485,150 L 498,145 L 500,162 L 492,172 L 482,168 Z" />
                  {/* Scandinavia */}
                  <path d="M 555,95 L 580,88 L 595,105 L 600,125 L 585,132 L 565,128 L 555,112 Z" />
                  {/* Africa */}
                  <path d="M 510,210 L 545,202 L 580,210 L 610,228 L 625,258 L 628,295 L 618,335 L 600,368 L 575,395 L 552,410 L 530,405 L 515,378 L 505,345 L 500,308 L 498,270 L 502,240 Z" />
                  {/* Arabian Peninsula */}
                  <path d="M 605,220 L 635,215 L 655,230 L 660,255 L 648,275 L 625,278 L 608,260 L 600,238 Z" />
                  {/* Middle East extension */}
                  <path d="M 615,195 L 640,190 L 658,205 L 655,220 L 635,222 L 618,210 Z" />
                  {/* Russia / North Asia */}
                  <path d="M 600,95 L 660,85 L 730,82 L 800,90 L 860,100 L 895,115 L 905,135 L 890,152 L 850,160 L 800,158 L 745,150 L 695,140 L 648,128 L 615,115 Z" />
                  {/* China / East Asia */}
                  <path d="M 750,160 L 800,158 L 840,165 L 860,185 L 855,210 L 830,225 L 800,228 L 770,220 L 750,200 L 745,178 Z" />
                  {/* India */}
                  <path d="M 685,215 L 715,210 L 735,225 L 740,255 L 730,280 L 710,292 L 690,285 L 680,260 L 680,235 Z" />
                  {/* SE Asia / Indochina */}
                  <path d="M 785,230 L 810,225 L 825,240 L 825,262 L 810,278 L 790,275 L 780,255 L 778,240 Z" />
                  {/* Indonesia archipelago */}
                  <path d="M 780,300 L 810,295 L 835,305 L 830,318 L 805,322 L 782,315 Z" />
                  <path d="M 840,305 L 865,300 L 880,312 L 870,325 L 848,322 Z" />
                  {/* Philippines */}
                  <path d="M 850,255 L 862,250 L 870,265 L 862,280 L 852,275 Z" />
                  {/* Japan */}
                  <path d="M 890,155 L 905,150 L 915,165 L 908,185 L 895,190 L 885,175 Z" />
                  {/* Australia */}
                  <path d="M 810,370 L 855,358 L 905,365 L 935,385 L 940,415 L 920,440 L 885,448 L 840,445 L 810,430 L 795,405 L 800,385 Z" />
                  {/* New Zealand */}
                  <path d="M 940,450 L 955,445 L 965,460 L 958,475 L 945,470 Z" />
                </clipPath>
              </defs>

              {/* Map group — centered vertically in the 1000x1000 viewBox.
                  Inner coords are 1000x560 (Mercator-ish), offset down by 220
                  so they map exactly to the square container percentages. */}
              <g transform="translate(0, 220)">

              {/* Subtle base grid (horizontal latitude hints) */}
              <g stroke="rgba(255,255,255,0.02)" strokeWidth="0.5">
                <line x1="0" y1="140" x2="1000" y2="140" />
                <line x1="0" y1="280" x2="1000" y2="280" />
                <line x1="0" y1="420" x2="1000" y2="420" />
              </g>

              {/* Continents — dot-filled clipped region */}
              <rect
                x="0"
                y="0"
                width="1000"
                height="560"
                fill="url(#continent-dots)"
                clipPath="url(#continents-clip)"
              />

              {/* Scattered particle stars (static coordinates to avoid hydration mismatch) */}
              <g filter="url(#glow)">
                {[
                  // teal particles
                  { x: 180, y: 120, r: 1.8, c: 'rgba(20,184,166,0.9)' },
                  { x: 240, y: 180, r: 1.2, c: 'rgba(20,184,166,0.7)' },
                  { x: 310, y: 90, r: 1.4, c: 'rgba(94,234,212,0.85)' },
                  { x: 150, y: 220, r: 1.0, c: 'rgba(20,184,166,0.5)' },
                  { x: 400, y: 140, r: 1.6, c: 'rgba(94,234,212,0.9)' },
                  { x: 470, y: 250, r: 1.3, c: 'rgba(20,184,166,0.7)' },
                  { x: 550, y: 310, r: 1.0, c: 'rgba(20,184,166,0.6)' },
                  { x: 620, y: 160, r: 1.5, c: 'rgba(94,234,212,0.8)' },
                  { x: 690, y: 110, r: 1.1, c: 'rgba(20,184,166,0.6)' },
                  { x: 760, y: 220, r: 1.7, c: 'rgba(94,234,212,0.9)' },
                  { x: 820, y: 95, r: 1.3, c: 'rgba(20,184,166,0.7)' },
                  { x: 880, y: 260, r: 1.0, c: 'rgba(20,184,166,0.5)' },
                  { x: 500, y: 420, r: 1.4, c: 'rgba(94,234,212,0.8)' },
                  { x: 360, y: 380, r: 1.2, c: 'rgba(20,184,166,0.6)' },
                  { x: 260, y: 430, r: 1.5, c: 'rgba(20,184,166,0.75)' },
                  { x: 720, y: 380, r: 1.3, c: 'rgba(94,234,212,0.8)' },
                  { x: 140, y: 340, r: 1.0, c: 'rgba(20,184,166,0.5)' },
                  { x: 580, y: 90, r: 1.2, c: 'rgba(20,184,166,0.6)' },
                  { x: 920, y: 180, r: 1.4, c: 'rgba(94,234,212,0.8)' },
                  { x: 80, y: 260, r: 1.1, c: 'rgba(20,184,166,0.55)' },
                  // purple/violet accent particles
                  { x: 220, y: 260, r: 1.6, c: 'rgba(167,139,250,0.85)' },
                  { x: 430, y: 330, r: 1.4, c: 'rgba(139,92,246,0.8)' },
                  { x: 680, y: 300, r: 1.8, c: 'rgba(167,139,250,0.9)' },
                  { x: 340, y: 200, r: 1.2, c: 'rgba(139,92,246,0.7)' },
                  { x: 790, y: 150, r: 1.1, c: 'rgba(167,139,250,0.7)' },
                  { x: 560, y: 220, r: 1.3, c: 'rgba(139,92,246,0.75)' },
                  { x: 880, y: 400, r: 1.0, c: 'rgba(167,139,250,0.6)' },
                  { x: 190, y: 450, r: 1.4, c: 'rgba(139,92,246,0.8)' },
                  // white sparkle
                  { x: 290, y: 160, r: 0.8, c: 'rgba(255,255,255,0.85)' },
                  { x: 510, y: 180, r: 0.7, c: 'rgba(255,255,255,0.7)' },
                  { x: 650, y: 240, r: 0.9, c: 'rgba(255,255,255,0.8)' },
                  { x: 380, y: 280, r: 0.6, c: 'rgba(255,255,255,0.6)' },
                  { x: 760, y: 340, r: 0.8, c: 'rgba(255,255,255,0.75)' },
                  { x: 110, y: 180, r: 0.7, c: 'rgba(255,255,255,0.65)' },
                  { x: 840, y: 440, r: 0.9, c: 'rgba(255,255,255,0.8)' },
                  { x: 450, y: 450, r: 0.7, c: 'rgba(255,255,255,0.7)' },
                  { x: 620, y: 450, r: 0.8, c: 'rgba(255,255,255,0.75)' },
                  { x: 280, y: 100, r: 0.6, c: 'rgba(255,255,255,0.6)' },
                ].map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} />
                ))}
              </g>

              {/* Connection arcs — dashed teal lines between nodes.
                  Endpoints use local coords that map to node positions:
                    Eagan    (225, 190) → container (22.5%, 41%)
                    Dubai    (630, 235) → container (63%, 45.5%)
                    Islamabad(725, 260) → container (72.5%, 48%)   */}
              <g>
                {/* Eagan → Dubai (great-circle sweep over North Atlantic & Europe) */}
                <path
                  d="M 225,190 Q 430,70 630,235"
                  stroke={TEAL}
                  strokeWidth="1.6"
                  strokeDasharray="2 5"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.85"
                  filter="url(#glow)"
                />
                {/* Eagan → Islamabad (longer arc, higher peak) */}
                <path
                  d="M 225,190 Q 475,30 725,260"
                  stroke="rgba(94,234,212,0.9)"
                  strokeWidth="1.4"
                  strokeDasharray="2 5"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.75"
                  filter="url(#glow)"
                />
                {/* Dubai → Islamabad (short regional hop) */}
                <path
                  d="M 630,235 Q 678,225 725,260"
                  stroke={TEAL}
                  strokeWidth="1.4"
                  strokeDasharray="2 4"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.85"
                  filter="url(#glow)"
                />
              </g>

              </g>
            </svg>

            {/* Location nodes — positioned in % relative to the square container */}
            <LocationNode
              top="41%"
              left="22.5%"
              label="EAGAN"
              active={region === 'Eagan'}
              labelPlacement="br"
            />
            <LocationNode
              top="45.5%"
              left="63%"
              label="DUBAI"
              active={region === 'Dubai'}
              labelPlacement="tl"
            />
            <LocationNode
              top="48%"
              left="72.5%"
              label="ISLAMABAD"
              active={region === 'Islamabad'}
              labelPlacement="br"
            />
          </div>
        </div>

        {/* Footer tagline */}
        <div className="relative z-10">
          <span
            className="text-[10px] uppercase font-bold"
            style={{
              color: 'rgba(255, 255, 255, 0.35)',
              letterSpacing: '0.24em',
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            Architectural Ledger v4.0
          </span>
        </div>
      </section>

      {/* ========== RIGHT PANEL — Welcome card (60%) ========== */}
      <section
        className="w-full lg:w-[60%] flex items-center justify-center p-6 lg:p-24"
        style={{ backgroundColor: SURFACE }}
      >
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: NAVY }}
            >
              <span className="font-black text-base" style={{ color: TEAL }}>
                99
              </span>
            </div>
            <span className="text-xl font-black tracking-tight" style={{ color: INK }}>
              99 Hub ERP
            </span>
          </div>

          {/* Login Card */}
          <div
            className="rounded-xl p-8 lg:p-10 relative overflow-hidden"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 32px 64px -12px rgba(11, 31, 58, 0.08)',
            }}
          >
            <div className="mb-10">
              <h2
                className="text-2xl font-bold tracking-tight mb-2"
                style={{ color: INK }}
              >
                Welcome Back
              </h2>
              <p className="text-sm" style={{ color: INK_MUTED }}>
                Please enter your professional credentials.
              </p>
            </div>

            {error && (
              <div
                className="mb-6 p-4 rounded-r"
                style={{
                  backgroundColor: 'rgba(225, 29, 72, 0.05)',
                  borderLeft: '2px solid #E11D48',
                }}
              >
                <p className="text-sm font-medium" style={{ color: '#E11D48' }}>
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Corporate Email */}
              <div className="space-y-1">
                <label
                  htmlFor="email"
                  className="block text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: OUTLINE }}
                >
                  Corporate Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@99hub.com"
                  className="w-full bg-transparent border-0 py-3 px-0 focus:outline-none focus:ring-0 text-sm"
                  style={{
                    borderBottom: '1px solid #C4C6CE',
                    color: INK,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderBottom = `2px solid ${TEAL}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderBottom = '1px solid #C4C6CE';
                  }}
                />
              </div>

              {/* Access Key */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="password"
                    className="block text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: OUTLINE }}
                  >
                    Access Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setError('Password reset is not yet configured. Contact System Admin.')}
                    className="text-[11px] font-bold uppercase tracking-widest transition-colors"
                    style={{ color: TEAL_DEEP }}
                  >
                    Forgot Key?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-0 py-3 px-0 focus:outline-none focus:ring-0 text-sm"
                  style={{
                    borderBottom: '1px solid #C4C6CE',
                    color: INK,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderBottom = `2px solid ${TEAL}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderBottom = '1px solid #C4C6CE';
                  }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-lg font-bold text-sm tracking-wide active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                style={{ backgroundColor: NAVY, color: '#FFFFFF' }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = TEAL_DEEP;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = NAVY;
                }}
              >
                {loading ? 'Authorizing…' : 'Authorize Access'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-10 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div
                  className="w-full"
                  style={{ borderTop: '1px solid rgba(196, 198, 206, 0.3)' }}
                />
              </div>
              <span
                className="relative px-4 text-[10px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: '#FFFFFF', color: OUTLINE }}
              >
                Directory SSO
              </span>
            </div>

            {/* SSO Button */}
            <button
              type="button"
              onClick={() => setError('Google Workspace SSO is not yet configured.')}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-lg text-sm font-medium active:scale-[0.98] transition-all"
              style={{
                border: '1px solid rgba(196, 198, 206, 0.4)',
                color: INK,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = SURFACE_LOW)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google Workspace
            </button>

            {/* Region Hub switcher */}
            <div
              className="mt-10 pt-6"
              style={{ borderTop: '1px solid rgba(196, 198, 206, 0.2)' }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: OUTLINE }}
                >
                  Region Hub
                </span>
                <div
                  className="flex items-center gap-1 p-1 rounded-full"
                  style={{ backgroundColor: SURFACE_LOW }}
                >
                  {(Object.keys(REGION_TZ) as Region[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRegion(r)}
                      className="px-3 py-1 text-[10px] font-medium rounded-full transition-colors"
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                        backgroundColor: region === r ? '#FFFFFF' : 'transparent',
                        color: region === r ? TEAL_DEEP : OUTLINE,
                        boxShadow: region === r ? '0 1px 2px rgba(11,31,58,0.08)' : 'none',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center text-[10px] uppercase">
                <span
                  style={{
                    color: OUTLINE,
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                    letterSpacing: '0.1em',
                  }}
                >
                  Current TZ
                </span>
                <span
                  style={{
                    color: INK,
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                    letterSpacing: '0.1em',
                  }}
                >
                  {REGION_TZ[region]}
                </span>
              </div>
            </div>
          </div>

          {/* Assistance Link */}
          <p className="text-center mt-10 text-sm" style={{ color: INK_MUTED }}>
            Need technical clearance?{' '}
            <a
              href="mailto:admin@99technologies.com"
              className="font-bold hover:underline"
              style={{ color: NAVY }}
            >
              Contact System Admin
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

// ----- local components -----

type LabelPlacement = 'br' | 'bl' | 'tr' | 'tl' | 'top' | 'bottom';

function LocationNode({
  top,
  left,
  label,
  active,
  labelPlacement = 'br',
}: {
  top: string;
  left: string;
  label: string;
  active: boolean;
  labelPlacement?: LabelPlacement;
}) {
  const TEAL = '#14B8A6';

  // Label offset presets (relative to the 6px core dot at 0,0)
  const labelStyle: React.CSSProperties = (() => {
    switch (labelPlacement) {
      case 'bl':
        return { top: 10, right: 10, left: 'auto', textAlign: 'right' };
      case 'tr':
        return { bottom: 10, left: 10, top: 'auto' };
      case 'tl':
        return { bottom: 10, right: 10, left: 'auto', top: 'auto', textAlign: 'right' };
      case 'top':
        return { bottom: 14, left: '50%', transform: 'translateX(-50%)', top: 'auto' };
      case 'bottom':
        return { top: 14, left: '50%', transform: 'translateX(-50%)' };
      case 'br':
      default:
        return { top: 10, left: 10 };
    }
  })();

  return (
    <div
      className="absolute"
      style={{ top, left, transform: 'translate(-50%, -50%)' }}
    >
      {/* Outer glow halo */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 28,
          height: 28,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: active
            ? 'radial-gradient(circle, rgba(20,184,166,0.35) 0%, rgba(20,184,166,0) 70%)'
            : 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, rgba(20,184,166,0) 70%)',
          filter: 'blur(2px)',
          pointerEvents: 'none',
        }}
      />
      {/* Concentric ring */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 14,
          height: 14,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          border: `1px solid ${active ? 'rgba(20,184,166,0.7)' : 'rgba(20,184,166,0.35)'}`,
          animation: active ? 'ledger-ping 2.4s ease-out infinite' : 'none',
          pointerEvents: 'none',
        }}
      />
      {/* Core dot */}
      <div
        style={{
          position: 'relative',
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: TEAL,
          boxShadow: active
            ? '0 0 10px rgba(20,184,166,0.9), 0 0 2px rgba(255,255,255,0.8)'
            : '0 0 6px rgba(20,184,166,0.55)',
        }}
      />
      {/* Label */}
      <span
        style={{
          position: 'absolute',
          ...labelStyle,
          fontSize: 9,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          color: TEAL,
          opacity: active ? 1 : 0.85,
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          letterSpacing: '0.18em',
          fontWeight: 600,
          textShadow: '0 1px 4px rgba(0,0,0,0.75)',
        }}
      >
        {label}
      </span>
      {/* Keyframes for ring ping */}
      <style jsx>{`
        @keyframes ledger-ping {
          0% {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 0.9;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
