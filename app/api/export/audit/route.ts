import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exportToCSV } from '@/lib/services/exportService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const format = searchParams.get('format') || 'csv';

    if (!['csv'].includes(format)) {
      return NextResponse.json({ error: 'Only CSV format is supported for audit export' }, { status: 400 });
    }

    // Build date filter
    const where: any = {};
    if (from) {
      where.createdAt = { gte: new Date(from) };
    }
    if (to) {
      if (where.createdAt) {
        where.createdAt.lte = new Date(to);
      } else {
        where.createdAt = { lte: new Date(to) };
      }
    }

    // Fetch audit logs with pagination support
    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        changedBy: {
          include: { employee: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Max export limit
    });

    // Format data for export
    const rows = auditLogs.map((log) => ({
      id: log.id,
      timestamp: new Date(log.createdAt).toLocaleString(),
      action: log.action,
      module: log.module || '',
      table: log.tableName,
      recordId: log.recordId,
      changedBy: log.changedBy?.employee
        ? `${log.changedBy.employee.firstName} ${log.changedBy.employee.lastName} (${log.changedBy.email})`
        : log.changedBy?.email || 'System',
      ipAddress: log.ipAddress || '',
      oldValues: typeof log.oldValues === 'string' ? log.oldValues : JSON.stringify(log.oldValues || {}),
      newValues: typeof log.newValues === 'string' ? log.newValues : JSON.stringify(log.newValues || {}),
    }));

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'action', label: 'Action' },
      { key: 'module', label: 'Module' },
      { key: 'table', label: 'Table' },
      { key: 'recordId', label: 'Record ID' },
      { key: 'changedBy', label: 'Changed By' },
      { key: 'ipAddress', label: 'IP Address' },
      { key: 'oldValues', label: 'Old Values' },
      { key: 'newValues', label: 'New Values' },
    ];

    const csv = exportToCSV(rows, columns);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-export.csv"`,
      },
    });
  } catch (error) {
    console.error('Audit export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
