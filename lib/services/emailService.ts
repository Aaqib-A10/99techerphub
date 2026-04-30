import { prisma } from '@/lib/prisma';
import { writeFileSync, appendFileSync, readFileSync, existsSync } from 'fs';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Email service.
 *
 * Production: uses a Nodemailer SMTP transporter when SMTP_HOST is set.
 * Development / unconfigured: falls back to logging emails as JSONL to
 *   /tmp/99tech-email-log.jsonl + console. Saves test work and lets the
 *   email-log page render historical sends.
 *
 * Env vars (prod):
 *   SMTP_HOST   — required to switch off the stub
 *   SMTP_PORT   — defaults to 587
 *   SMTP_SECURE — "true" for port 465 (SMTPS), otherwise STARTTLS at 587
 *   SMTP_USER   — auth username
 *   SMTP_PASS   — auth password
 *   SMTP_FROM   — default From: header (e.g. "99 Tech HR <hr@99tech.com>")
 */

interface Attachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Attachment[];
  templateKey?: string; // For audit / log only
  mergeData?: Record<string, any>;
}

const EMAIL_LOG_FILE = '/tmp/99tech-email-log.jsonl';

let cachedTransporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (cachedTransporter) return cachedTransporter;
  const port = Number(process.env.SMTP_PORT) || 587;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure:
      process.env.SMTP_SECURE === 'true' || port === 465, // SMTPS vs STARTTLS
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
  return cachedTransporter;
}

function applyMergeFields(template: string, mergeData: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(mergeData)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}

export async function renderTemplate(
  templateKey: string,
  mergeData: Record<string, any>,
): Promise<{ subject: string; html: string }> {
  const template = await prisma.emailTemplate.findUnique({ where: { templateKey } });
  if (!template) throw new Error(`Email template not found: ${templateKey}`);
  return {
    subject: applyMergeFields(template.subject, mergeData),
    html: applyMergeFields(template.bodyHtml, mergeData),
  };
}

function logEmail(record: Record<string, any>): void {
  try {
    appendFileSync(EMAIL_LOG_FILE, JSON.stringify(record) + '\n');
  } catch (err) {
    console.warn('Failed to write email log:', err);
  }
}

export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ sent: boolean; id: string; transport: 'smtp' | 'stub' }> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || 'no-reply@99tech.local';
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const baseRecord = {
    id: messageId,
    timestamp: new Date().toISOString(),
    to: options.to,
    subject: options.subject,
    templateKey: options.templateKey || 'MANUAL',
    preview: options.bodyHtml.substring(0, 200).replace(/<[^>]*>/g, ''),
    hasAttachments: (options.attachments?.length ?? 0) > 0,
  };

  if (!transporter) {
    // Stub: log + console.
    logEmail({ ...baseRecord, transport: 'stub' });
    console.log('[EMAIL STUB]', { messageId, to: options.to, subject: options.subject });
    return { sent: true, id: messageId, transport: 'stub' };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.bodyHtml,
      text: options.bodyText,
      attachments: options.attachments,
    });
    logEmail({
      ...baseRecord,
      transport: 'smtp',
      smtpMessageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
    return { sent: true, id: info.messageId || messageId, transport: 'smtp' };
  } catch (err: any) {
    logEmail({
      ...baseRecord,
      transport: 'smtp',
      error: err?.message ?? String(err),
    });
    console.error('[EMAIL SMTP ERROR]', err);
    throw new Error(`SMTP send failed: ${err?.message ?? 'unknown error'}`);
  }
}

export async function getEmailLog(limit = 100): Promise<any[]> {
  try {
    if (!existsSync(EMAIL_LOG_FILE)) return [];
    const content = readFileSync(EMAIL_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function clearEmailLog(): Promise<void> {
  try {
    writeFileSync(EMAIL_LOG_FILE, '');
  } catch (err) {
    console.warn('Failed to clear email log:', err);
  }
}
