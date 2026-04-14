import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * Resolve an asset tag (e.g. "LAPTOP-0001") to its ID so the scanner
 * can redirect to the detail page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { tag: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tag = decodeURIComponent(params.tag).trim();
    if (!tag) {
      return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
    }

    const asset = await prisma.asset.findFirst({
      where: { assetTag: tag },
      select: { id: true, assetTag: true },
    });

    if (!asset) {
      return NextResponse.json(
        { error: `No asset found for tag ${tag}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: asset.id, assetTag: asset.assetTag });
  } catch (error: any) {
    console.error('Error resolving asset tag:', error);
    return NextResponse.json(
      { error: 'Failed to resolve tag' },
      { status: 500 }
    );
  }
}
