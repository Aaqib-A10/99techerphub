import React from 'react';

/**
 * Avatar — circular gradient with initials. When a real photo is
 * available, render an <img> instead and fall back to this for missing
 * photos.
 *
 * Six gradient tones are picked deterministically from a string seed
 * (typically empCode) so the same person always gets the same color.
 */
export type AviTone = 'green' | 'blue' | 'rose' | 'amber' | 'violet' | 'pink';

const GRADIENTS: Record<AviTone, string> = {
  green:  'linear-gradient(135deg,#A8D45A,#6FA024)',
  blue:   'linear-gradient(135deg,#7DB1E8,#3D7BC4)',
  rose:   'linear-gradient(135deg,#E8A0A0,#C46060)',
  amber:  'linear-gradient(135deg,#E8C079,#C29040)',
  violet: 'linear-gradient(135deg,#A98EE0,#7050C0)',
  pink:   'linear-gradient(135deg,#E8A0BF,#C25080)',
};

const TONE_ORDER: AviTone[] = ['green', 'blue', 'rose', 'amber', 'violet', 'pink'];

/** Hash a string to a tone — same seed always picks the same color. */
export function aviToneForSeed(seed: string): AviTone {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return TONE_ORDER[Math.abs(hash) % TONE_ORDER.length];
}

interface Props {
  initials: string;
  tone?: AviTone;
  /** Pass a stable identifier (empCode, email) to auto-pick a tone. */
  seed?: string;
  size?: number;
  /** Real photo URL; falls back to initials if missing or fails to load. */
  photoUrl?: string | null;
}

export default function Avi({
  initials,
  tone,
  seed,
  size = 28,
  photoUrl,
}: Props) {
  const resolvedTone: AviTone = tone ?? (seed ? aviToneForSeed(seed) : 'green');
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        className="inline-flex flex-shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: GRADIENTS[resolvedTone],
        fontSize: Math.max(9, size * 0.38),
      }}
    >
      {initials}
    </div>
  );
}
