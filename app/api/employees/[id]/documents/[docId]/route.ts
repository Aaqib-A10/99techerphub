import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; docId: string } }) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = parseInt(params.id);
    const docId = parseInt(params.docId);
    const document = await prisma.employeeDocument.findUnique({ where: { id: docId } });

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (document.employeeId !== employeeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    if (document.fileUrl) {
      const filename = document.fileUrl.split('/').pop();
      const filepath = join(process.cwd(), 'public', 'uploads', 'employees', employeeId.toString(), filename || '');
      if (existsSync(filepath)) {
        try { await unlink(filepath); } catch (err) { console.error(err); }
      }
    }

    const deletedDocument = await prisma.employeeDocument.delete({ where: { id: docId } });
    await prisma.auditLog.create({
      data: { tableName: 'employee_documents', recordId: docId, action: 'DELETE', module: 'EMPLOYEE', newValues: deletedDocument },
    });

    return NextResponse.json(deletedDocument, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}