import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

// Deprecated one-shot migration route. Table has already been created; this now returns 410 Gone.
export async function POST() {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Migration already applied. This endpoint has been retired.' },
      { status: 410 }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
