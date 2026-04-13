import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    const data = await request.json();
    const { action } = data;

    const updateData: any = {};

    if (action === 'submit_review') {
      updateData.status = 'UNDER_REVIEW';
      updateData.reviewedBy = 1;
    } else if (action === 'send') {
      updateData.status = 'SENT';
      updateData.sentAt = new Date();
    } else if (action === 'acknowledge') {
      updateData.status = 'ACKNOWLEDGED';
      updateData.acknowledgedAt = new Date();
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (data.notes) updateData.notes = data.notes;

    const report = await prisma.monthlyReport.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'monthly_reports',
        recordId: report.id,
        action: 'UPDATE',
        module: 'FINANCE',
        newValues: report,
      },
    });

    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update report', details: error?.message }, { status: 500 });
  }
}
