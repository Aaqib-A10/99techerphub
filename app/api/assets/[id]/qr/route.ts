import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';

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
    const id = parseInt(params.id);
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { assetTag: true },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Build a self-referencing URL that the scan page can resolve.
    const origin = request.nextUrl.origin;
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
        'Cache-Control': 'public, max-age=3600',
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
