import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

const getTemplateBody = (letter: any): string => {
  const formatDate = (date: any) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  let body = '';

  if (letter.templateType === 'PERMANENT') {
    body = `We are pleased to offer you the position of ${letter.position} at 99 Technologies (${letter.companyName}), effective ${formatDate(letter.startDate)}. You will report to ${letter.reportingTo} in our ${letter.department} department. This is a full-time ${letter.contractType} position. Your initial annual compensation will be ${letter.currency} ${letter.salary?.toLocaleString()}, plus the benefits outlined below. Your continued employment is contingent upon satisfactory performance and adherence to company policies.`;
  } else if (letter.templateType === 'PROBATION') {
    body = `We are pleased to offer you the position of ${letter.position} at 99 Technologies (${letter.companyName}) on a probationary basis for ${letter.probationPeriod}, commencing ${formatDate(letter.startDate)}. During your probation, you will report to ${letter.reportingTo}. Upon successful completion of your probation period, your employment will be confirmed as permanent. Your monthly compensation during probation will be ${letter.currency} ${letter.salary?.toLocaleString()}.`;
  } else if (letter.templateType === 'CONSULTANT') {
    body = `We are pleased to engage you as a Consultant for the role of ${letter.position} with 99 Technologies (${letter.companyName}), effective ${formatDate(letter.startDate)}. This is a consultancy agreement and not an employment relationship. Your retainer will be ${letter.currency} ${letter.salary?.toLocaleString()} per month.`;
  } else if (letter.templateType === 'CUSTOM') {
    body = letter.customBody || '';
  }

  return body;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);

    const offerLetter = await prisma.offerLetter.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!offerLetter) {
      return NextResponse.json(
        { error: 'Offer letter not found' },
        { status: 404 }
      );
    }

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const templateBody = getTemplateBody(offerLetter);

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer Letter - ${offerLetter.candidateName}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 850px; margin: 0 auto; background: white; padding: 40px; }
    .header { text-align: center; border-bottom: 3px solid #00C853; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 28px; font-weight: bold; color: #00C853; margin: 0; }
    .company-tagline { color: #009624; font-size: 12px; margin: 5px 0 0 0; }
    .date { text-align: right; margin-bottom: 30px; color: #666; }
    .recipient { margin-bottom: 30px; line-height: 1.8; }
    .subject { text-align: center; font-size: 18px; font-weight: bold; color: #009624; margin: 30px 0; text-transform: uppercase; }
    .body-text { text-align: justify; margin-bottom: 20px; line-height: 1.8; }
    .benefits-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    .benefits-table th, .benefits-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    .benefits-table th { background-color: #00C853; color: white; }
    .closing { margin-top: 30px; text-align: justify; line-height: 1.8; }
    .signature-section { margin-top: 40px; padding-top: 40px; border-top: 1px solid #ddd; }
    .signature-line { border-bottom: 1px solid #000; margin-bottom: 5px; height: 60px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    .no-print { padding: 20px 0; text-align: center; }
    .btn { display: inline-block; padding: 10px 20px; background-color: #00C853; color: white; text-decoration: none; border-radius: 4px; border: none; cursor: pointer; font-size: 14px; }
    @media print { .no-print { display: none !important; } .container { box-shadow: none; max-width: 100%; margin: 0; padding: 0; } }
  </style>
</head>
<body>
  <div class="no-print" style="background-color: white; padding: 20px; text-align: center; border-bottom: 1px solid #ddd;">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="container">
    <div class="header">
      <p class="company-name">99 Technologies</p>
      <p class="company-tagline">ORGANIZATIONAL TRACKING SYSTEM</p>
    </div>

    <div class="date"><strong>Date:</strong> ${formatDate(new Date())}</div>

    <div class="recipient">
      <div style="font-weight: bold;">${offerLetter.candidateName}</div>
      ${offerLetter.candidateEmail ? `<div>${offerLetter.candidateEmail}</div>` : ''}
    </div>

    <div class="subject">Offer of Employment</div>

    <div class="body-text">
      <p>Dear ${(offerLetter.candidateName || '').split(' ')[0]},</p>
      <p>${templateBody}</p>
    </div>

    <table class="benefits-table">
      <tr>
        <th>Particulars</th>
        <th>Details</th>
      </tr>
      <tr>
        <td>Base Salary</td>
        <td>${offerLetter.currency} ${offerLetter.salary?.toLocaleString()}</td>
      </tr>
      ${offerLetter.benefits ? `<tr><td>Benefits</td><td>${offerLetter.benefits.replace(/\n/g, '<br>')}</td></tr>` : ''}
      ${offerLetter.workingHours ? `<tr><td>Working Hours</td><td>${offerLetter.workingHours.replace(/\n/g, '<br>')}</td></tr>` : ''}
    </table>

    <div class="closing">
      <p>We believe you will be a valuable addition to our team and look forward to your contributions. This offer is contingent upon satisfactory completion of background verification and other pre-employment checks.</p>
      <p>Please confirm your acceptance of this offer by signing and returning a copy of this letter within 7 days. Should you have any questions or require clarification, please do not hesitate to contact us.</p>
      ${offerLetter.terms ? `<p><strong>Additional Terms:</strong><br>${offerLetter.terms.replace(/\n/g, '<br>')}</p>` : ''}
    </div>

    <div class="signature-section">
      <p>Yours sincerely,</p>
      <div style="width: 300px;">
        <div class="signature-line"></div>
        <div style="font-size: 12px; margin-top: 5px;">
          <strong>HR Department</strong><br>
          99 Technologies
        </div>
      </div>
    </div>

    <div class="footer">
      <p>This is an official document from 99 Technologies. For inquiries, please contact HR Department.</p>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="offer-letter-${(offerLetter.candidateName || '').replace(/\s+/g, '-')}.html"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
