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

    // Build a self-referencing URL that the scan page can resolve.
    //
    // Behind Cloudflare / a reverse proxy, `request.nextUrl.origin` can
    // resolve to the internal hostname (localhost:3000) instead of the
    // public domain — that was sending scanned labels to localhost.
    // Prefer NEXT_PUBLIC_APP_URL (set explicitly in .env on prod), then
    // the proxy-forwarded host, then the request's own origin as a last
    // resort.
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
    const explicitOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    const proxyOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;
    const origin = explicitOrigin || proxyOrigin || request.nextUrl.origin;
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
