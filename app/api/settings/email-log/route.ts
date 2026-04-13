import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { readFileSync } from 'fs';

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.HR)) {
      return NextResponse.json(
        { error: 'Forbidden: Only ADMIN and HR can access email log' },
        { status: 403 }
      );
    }

    // Read email log file
    const emails: any[] = [];
    try {
      const content = readFileSync('/tmp/99tech-email-log.jsonl', 'utf-8');
      const lines = content.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            emails.push(JSON.parse(line));
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch {
      // File doesn't exist yet
    }

    // Return in reverse order (newest first)
    return NextResponse.json(
      {
        emails: emails.reverse(),
        total: emails.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Settings/EmailLog]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
