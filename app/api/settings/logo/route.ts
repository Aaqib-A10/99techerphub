import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getSessionUser } from '@/lib/auth';

// Allowed file types for the branding logo
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
  'image/webp',
];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — logos should be small

const LOGO_DIR = join(process.cwd(), 'public', 'uploads', 'branding');
const LOGO_BASENAME = 'logo';

// --------------------------------------------------------------
// Helper: find the current logo on disk (if any).
// Since extension varies, we scan the branding directory.
// --------------------------------------------------------------
const findCurrentLogo = async (): Promise<{
  filename: string;
  url: string;
} | null> => {
  if (!existsSync(LOGO_DIR)) return null;
  try {
    const files = await readdir(LOGO_DIR);
    const match = files.find((f) => f.startsWith(`${LOGO_BASENAME}.`));
    if (!match) return null;
    return {
      filename: match,
      // Cache-bust with mtime so updates show immediately
      url: `/uploads/branding/${match}?v=${Date.now()}`,
    };
  } catch {
    return null;
  }
};

// --------------------------------------------------------------
// GET — return the current logo URL (or null)
// --------------------------------------------------------------
export async function GET() {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const current = await findCurrentLogo();
    return NextResponse.json({ logo: current });
  } catch (error: any) {
    console.error('Error fetching logo:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logo' },
      { status: 500 }
    );
  }
}

// --------------------------------------------------------------
// POST — upload a new logo (replaces any existing one)
// --------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            'Invalid file type. Only PNG, JPG, SVG, and WebP are allowed.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 2MB limit' },
        { status: 400 }
      );
    }

    // Create branding directory if needed
    if (!existsSync(LOGO_DIR)) {
      await mkdir(LOGO_DIR, { recursive: true });
    }

    // Remove any existing logo.* files so only one logo exists at a time
    try {
      const files = await readdir(LOGO_DIR);
      for (const f of files) {
        if (f.startsWith(`${LOGO_BASENAME}.`)) {
          await unlink(join(LOGO_DIR, f));
        }
      }
    } catch {
      // Ignore cleanup errors — we'll still attempt the write
    }

    // Derive extension from mime type (more reliable than file.name)
    const extFromMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
    };
    const ext = extFromMime[file.type] || 'png';
    const filename = `${LOGO_BASENAME}.${ext}`;
    const filepath = join(LOGO_DIR, filename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    return NextResponse.json(
      {
        success: true,
        logo: {
          filename,
          url: `/uploads/branding/${filename}?v=${Date.now()}`,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

// --------------------------------------------------------------
// DELETE — remove the current logo (revert to default)
// --------------------------------------------------------------
export async function DELETE() {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!existsSync(LOGO_DIR)) {
      return NextResponse.json({ success: true, removed: false });
    }
    const files = await readdir(LOGO_DIR);
    let removed = 0;
    for (const f of files) {
      if (f.startsWith(`${LOGO_BASENAME}.`)) {
        await unlink(join(LOGO_DIR, f));
        removed++;
      }
    }
    return NextResponse.json({ success: true, removed: removed > 0 });
  } catch (error: any) {
    console.error('Error removing logo:', error);
    return NextResponse.json(
      { error: 'Failed to remove logo' },
      { status: 500 }
    );
  }
}
