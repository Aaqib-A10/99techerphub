import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const skip = (page - 1) * limit;

    // Filters
    const module = searchParams.get('module');
    const action = searchParams.get('action');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const search = searchParams.get('search');

    // Build where clause
    const where: Prisma.AuditLogWhereInput = {};

    if (module && module !== 'ALL') {
      where.module = module;
    }

    if (action && action !== 'ALL') {
      where.action = action as any;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        {
          recordId: isNaN(parseInt(search)) ? undefined : parseInt(search),
        },
        {
          tableName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          changedBy: {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ].filter(
        (condition) =>
          condition.recordId !== undefined ||
          condition.tableName !== undefined ||
          condition.changedBy !== undefined
      );
    }

    // Fetch audit logs with user data
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          changedBy: {
            select: {
              id: true,
              email: true,
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Get stats
    const [totalEntries, entriesCount, moduleStats] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      prisma.auditLog.groupBy({
        by: ['module'],
        _count: { id: true },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 1,
      }),
    ]);

    const mostActiveModule = moduleStats[0]?.module || 'UNKNOWN';

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats: {
        totalEntries,
        entriesCount,
        mostActiveModule,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
