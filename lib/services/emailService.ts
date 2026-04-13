import { prisma } from '@/lib/prisma';
import { writeFileSync, appendFileSync } from 'fs';
import path from 'path';

/**
 * Email service stub that logs emails instead of sending them.
 * When SMTP is configured later, swap implementation to actual sending.
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  templateKey?: string; // For audit
  mergeData?: Record<string, any>;
}

// Email log file path (in /tmp for development)
const EMAIL_LOG_FILE = '/tmp/99tech-email-log.jsonl';

/**
 * Apply merge fields to an email template
 */
function applyMergeFields(template: string, mergeData: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(mergeData)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}

/**
 * Render an email template with merge data
 */
export async function renderTemplate(
  templateKey: string,
  mergeData: Record<string, any>
): Promise<{ subject: string; html: string }> {
  const template = await prisma.emailTemplate.findUnique({
    where: { templateKey },
  });

  if (!template) {
    throw new Error(`Email template not found: ${templateKey}`);
  }

  const subject = applyMergeFields(template.subject, mergeData);
  const html = applyMergeFields(template.bodyHtml, mergeData);

  return { subject, html };
}

/**
 * Send an email (stub implementation - logs instead of sending)
 */
export async function sendEmail(options: SendEmailOptions): Promise<{
  sent: boolean;
  id: string;
}> {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Build the email record
  const emailRecord = {
    id: messageId,
    timestamp: new Date().toISOString(),
    to: options.to,
    subject: options.subject,
    templateKey: options.templateKey || 'MANUAL',
    preview: options.bodyHtml.substring(0, 200).replace(/<[^>]*>/g, ''),
  };

  // Log to file (JSONL format for easy parsing)
  try {
    appendFileSync(EMAIL_LOG_FILE, JSON.stringify(emailRecord) + '\n');
  } catch (err) {
    console.warn('Failed to write email log:', err);
  }

  // Also log to console for development
  console.log('[EMAIL STUB]', {
    messageId,
    to: options.to,
    subject: options.subject,
    templateKey: options.templateKey,
  });

  return {
    sent: true,
    id: messageId,
  };
}

/**
 * Get email log entries (for the email-log page)
 */
export async function getEmailLog(limit = 100): Promise<any[]> {
  try {
    const fs = require('fs');
    const content = fs.readFileSync(EMAIL_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    return lines
      .slice(-limit)
      .reverse()
      .map((line: string) => JSON.parse(line))
      .catch(() => []);
  } catch {
    return [];
  }
}

/**
 * Clear email log (for testing)
 */
export async function clearEmailLog(): Promise<void> {
  try {
    writeFileSync(EMAIL_LOG_FILE, '');
  } catch (err) {
    console.warn('Failed to clear email log:', err);
  }
}
