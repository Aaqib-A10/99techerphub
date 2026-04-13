import { prisma } from '@/lib/prisma';

export async function renderTemplate(
  templateKey: string,
  mergeData: Record<string, string>
): Promise<{ subject: string; body: string }> {
  const template = await prisma.emailTemplate.findUnique({
    where: { templateKey },
  });

  if (!template) {
    throw new Error(`Template not found: ${templateKey}`);
  }

  let subject = template.subject;
  let body = template.bodyHtml;

  for (const [key, value] of Object.entries(mergeData)) {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    subject = subject.replace(pattern, String(value));
    body = body.replace(pattern, String(value));
  }

  return { subject, body };
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '');
}

export function previewTemplate(
  subject: string,
  body: string,
  mergeFields: string[] | null
): { subject: string; body: string } {
  let previewSubject = subject;
  let previewBody = body;

  if (mergeFields && Array.isArray(mergeFields)) {
    mergeFields.forEach((field) => {
      const pattern = new RegExp(`{{\\s*${field}\\s*}}`, 'g');
      previewSubject = previewSubject.replace(pattern, `[${field}]`);
      previewBody = previewBody.replace(pattern, `[${field}]`);
    });
  }

  return { subject: previewSubject, body: previewBody };
}
