import { NextResponse } from 'next/server';

// Deprecated one-shot migration route. Table has already been created; this now returns 410 Gone.
export async function POST() {
  return NextResponse.json(
    { error: 'Migration already applied. This endpoint has been retired.' },
    { status: 410 }
  );
}
