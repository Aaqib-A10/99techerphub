import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';
import { getSessionUser } from '@/lib/auth';

/**
 * Generates a real, scannable QR code (SVG) for an asset.
 *
 * The QR encodes a URL like:
 *   http://<origin>/assets/scan?tag=<ASSET_TAG>
 *
 * Any QR reader (phone camera, built-in iOS/Android scanner, or the
 * in-app /assets/scan page) will decode this URL. The in-app scan
 * page resolves the tag to the real asset detail route.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { assetTag: true },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Resolve the public-facing origin the QR should point to.
    //
    // Behind Cloudflare / nginx, the proxied request reaches Next.js
    // bound to localhost:3000 — `request.nextUrl.origin` reads that
    // internal address, which is why scanned labels were sending
    // people to localhost. Source-of-truth order:
    //   1. NEXT_PUBLIC_APP_URL — set in .env, the canonical answer.
    //   2. x-forwarded-host — Cloudflare + most proxies set this.
    //   3. host header — what the original client requested.
    //   4. request.nextUrl.origin — internal bind, often localhost.
    // If everything resolves to localhost in production, that's a misconfig
    // and we'd rather refuse than embed a broken URL.
    function pickOrigin(): string | null {
      const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
      if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) return fromEnv;

      const proto =
        request.headers.get('x-forwarded-proto') ??
        (process.env.NODE_ENV === 'production' ? 'https' : 'http');

      const xfh = request.headers.get('x-forwarded-host');
      if (xfh && !/localhost|127\.0\.0\.1/i.test(xfh)) return `${proto}://${xfh}`;

      const host = request.headers.get('host');
      if (host && !/localhost|127\.0\.0\.1/i.test(host)) return `${proto}://${host}`;

      const fallback = request.nextUrl.origin;
      if (!/localhost|127\.0\.0\.1/i.test(fallback)) return fallback;

      // Last resort: env var even if it looks like localhost (so dev
      // still works), or null in prod so we surface the misconfig.
      if (process.env.NODE_ENV !== 'production') return fromEnv || fallback;
      return fromEnv || null;
    }

    const origin = pickOrigin();
    if (!origin) {
      return NextResponse.json(
        {
          error:
            'Cannot determine public origin. Set NEXT_PUBLIC_APP_URL in the prod .env (e.g. https://99techerp.com) and restart PM2.',
        },
        { status: 500 },
      );
    }
    const payload = `${origin}/assets/scan?tag=${encodeURIComponent(asset.assetTag)}`;

    // Generate a real, scannable QR code as SVG.
    const svg = await QRCode.toString(payload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        // Don't cache long — labels are regenerated cheaply and stale
        // origins (e.g. while NEXT_PUBLIC_APP_URL is being rotated) hurt
        // more than the bandwidth saving helps.
        'Cache-Control': 'public, max-age=60, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}
