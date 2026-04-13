import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Receipt OCR endpoint — reads an uploaded receipt image and asks Claude's
 * vision API to extract structured fields that can pre-fill the expense form.
 *
 * Input (JSON):
 *   { receiptUrl: "/uploads/receipts/1234-abcd.jpg" }
 *
 * Output:
 *   {
 *     vendor: string | null,
 *     amount: number | null,
 *     currency: string | null,
 *     expenseDate: string | null,     // ISO date yyyy-mm-dd
 *     invoiceNumber: string | null,
 *     description: string | null,
 *     categorySuggestion: string | null,
 *     confidence: "high" | "medium" | "low",
 *     rawText: string | null
 *   }
 *
 * Requires ANTHROPIC_API_KEY env variable.
 */

const ANTHROPIC_MODEL = 'claude-sonnet-4-5';
const OCR_PROMPT = `You are a receipt / invoice OCR extractor. Look at the image and return a single JSON object with exactly these keys:

{
  "vendor": "<merchant or vendor name, or null>",
  "amount": <grand total as a number with no currency symbol, or null>,
  "currency": "<3-letter ISO code like PKR, USD, AED, or null>",
  "expenseDate": "<transaction date in YYYY-MM-DD, or null>",
  "invoiceNumber": "<invoice/receipt number, or null>",
  "description": "<one short sentence describing what was purchased>",
  "categorySuggestion": "<best guess from: Hardware, Software, Utilities, Travel, Meals, Office Supplies, Marketing, Training, Miscellaneous>",
  "confidence": "<high | medium | low>",
  "rawText": "<all text visible on the receipt, newline-separated>"
}

Rules:
- Return ONLY the JSON object. No markdown fences, no commentary, no prose before or after.
- If a field cannot be determined, use null.
- For amount, return the grand total (including tax), not a subtotal.
- If the receipt shows no currency symbol, infer from context (Pakistani receipts default to PKR).
- Never invent data. Use null when unsure.`;

export async function POST(request: NextRequest) {
  try {
    const { receiptUrl } = await request.json();

    if (!receiptUrl || typeof receiptUrl !== 'string') {
      return NextResponse.json(
        { error: 'receiptUrl is required' },
        { status: 400 }
      );
    }

    if (!receiptUrl.startsWith('/uploads/receipts/')) {
      return NextResponse.json(
        { error: 'Invalid receipt URL' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'ANTHROPIC_API_KEY is not configured. Add it to .env.local and restart the dev server.',
        },
        { status: 500 }
      );
    }

    // Read file from disk
    const relPath = receiptUrl.replace(/^\//, '');
    const absPath = join(process.cwd(), 'public', relPath);
    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(absPath);
    } catch {
      return NextResponse.json(
        { error: 'Receipt file not found on disk' },
        { status: 404 }
      );
    }

    // Determine media type from extension
    const ext = receiptUrl.split('.').pop()?.toLowerCase() || '';
    let mediaType: string;
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        mediaType = 'image/jpeg';
        break;
      case 'png':
        mediaType = 'image/png';
        break;
      case 'webp':
        mediaType = 'image/webp';
        break;
      case 'gif':
        mediaType = 'image/gif';
        break;
      case 'pdf':
        // Anthropic supports PDF via a document content block, but the same base64 shape
        // works — set media type accordingly.
        mediaType = 'application/pdf';
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported file type: ${ext}` },
          { status: 400 }
        );
    }

    const base64 = fileBuffer.toString('base64');

    // Build content block — PDFs use type=document, images use type=image
    const contentBlock =
      mediaType === 'application/pdf'
        ? {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          }
        : {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          };

    // Call Anthropic messages API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              {
                type: 'text',
                text: OCR_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text();
      console.error('[expenses/ocr] Anthropic API error:', anthropicResponse.status, errBody);
      return NextResponse.json(
        {
          error: 'Anthropic API call failed',
          status: anthropicResponse.status,
          details: errBody.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const result = await anthropicResponse.json();
    const textBlock = Array.isArray(result.content)
      ? result.content.find((c: any) => c.type === 'text')
      : null;
    const rawText: string = textBlock?.text?.trim() ?? '';

    // Strip possible markdown fences just in case
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[expenses/ocr] Failed to parse Claude response:', cleaned);
      return NextResponse.json(
        {
          error: 'OCR response was not valid JSON',
          raw: cleaned.slice(0, 500),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      vendor: parsed.vendor ?? null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      currency: parsed.currency ?? null,
      expenseDate: parsed.expenseDate ?? null,
      invoiceNumber: parsed.invoiceNumber ?? null,
      description: parsed.description ?? null,
      categorySuggestion: parsed.categorySuggestion ?? null,
      confidence: parsed.confidence ?? 'low',
      rawText: parsed.rawText ?? null,
    });
  } catch (err: any) {
    console.error('[expenses/ocr]', err);
    return NextResponse.json(
      { error: 'OCR failed', details: err?.message },
      { status: 500 }
    );
  }
}
