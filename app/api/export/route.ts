import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// Helper function to escape CSV fields
function escapeCSV(field: string | number | boolean | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  // If field contains comma, newline, or quotes, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Convert array of objects to CSV string
function arrayToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.join(',');
  const dataRows = data.map((row) =>
    headers.map((header) => escapeCSV(row[header])).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

// ---- spec helpers (kept in sync with /app/assets/page.tsx) ----
function readSpec(
  specs: Record<string, string> | null | undefined,
  aliases: string[]
): string {
  if (!specs || typeof specs !== 'object') return '';
  const entries = Object.entries(specs);
  for (const alias of aliases) {
    const lc = alias.toLowerCase();
    const hit = entries.find(([k]) => k.toLowerCase() === lc);
    if (hit && hit[1]) return String(hit[1]);
  }
  for (const alias of aliases) {
    const lc = alias.toLowerCase();
    const hit = entries.find(([k]) => k.toLowerCase().includes(lc));
    if (hit && hit[1]) return String(hit[1]);
  }
  return '';
}
const RAM_ALIASES = ['RAM', 'Memory'];
const STORAGE_ALIASES = ['Storage', 'SSD', 'HDD', 'Disk'];
const CPU_ALIASES = ['Processor', 'CPU'];
const GPU_ALIASES = ['Graphics', 'GPU', 'Video Card'];

// Assets export handler
async function exportAssets(
  searchParams: URLSearchParams
): Promise<{ data: any[]; headers: string[] }> {
  const companyId = searchParams.get('companyId')
    ? parseInt(searchParams.get('companyId')!)
    : undefined;
  const categoryId = searchParams.get('categoryId')
    ? parseInt(searchParams.get('categoryId')!)
    : undefined;
  const condition = searchParams.get('condition') || undefined;
  const employeeId = searchParams.get('employeeId')
    ? parseInt(searchParams.get('employeeId')!)
    : undefined;
  const assignment = (searchParams.get('assignment') || '').toLowerCase();

  const q = (searchParams.get('q') || '').trim();
  const ramFilter = (searchParams.get('ram') || '').trim().toLowerCase();
  const storageFilter = (searchParams.get('storage') || '').trim().toLowerCase();
  const cpuFilter = (searchParams.get('cpu') || '').trim().toLowerCase();
  const gpuFilter = (searchParams.get('gpu') || '').trim().toLowerCase();

  const where: any = {};
  if (companyId) where.companyId = companyId;
  if (categoryId) where.categoryId = categoryId;
  if (condition) where.condition = condition;

  // Assignment / employee filters (mirrors logic in /app/assets/page.tsx)
  if (employeeId) {
    where.assignments = { some: { employeeId, returnedDate: null } };
  } else if (assignment === 'assigned') {
    if (!where.AND) where.AND = [];
    where.AND.push({
      OR: [
        { assignments: { some: { returnedDate: null } } },
        { assignedToName: { not: null, notIn: ['', 'Available', 'available'] } },
      ],
    });
  } else if (assignment === 'unassigned') {
    if (!where.AND) where.AND = [];
    where.AND.push(
      { assignments: { none: { returnedDate: null } } },
      {
        OR: [
          { assignedToName: null },
          { assignedToName: { in: ['', 'Available', 'available'] } },
        ],
      },
    );
  }

  if (q) {
    where.OR = [
      { assetTag: { contains: q, mode: 'insensitive' } },
      { serialNumber: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
      { manufacturer: { contains: q, mode: 'insensitive' } },
      { assignedToName: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
    ];
  }

  const assetsRaw = await prisma.asset.findMany({
    where,
    include: {
      category: true,
      company: true,
      location: true,
      assignments: {
        where: { returnedDate: null },
        include: { employee: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Spec filters applied in JS because specs are JSON.
  const assets = assetsRaw.filter((a) => {
    const specs = (a.specs as Record<string, string> | null) || {};
    const ram = readSpec(specs, RAM_ALIASES).toLowerCase();
    const storage = readSpec(specs, STORAGE_ALIASES).toLowerCase();
    const cpu = readSpec(specs, CPU_ALIASES).toLowerCase();
    const gpu = readSpec(specs, GPU_ALIASES).toLowerCase();
    if (ramFilter && !ram.includes(ramFilter)) return false;
    if (storageFilter && !storage.includes(storageFilter)) return false;
    if (cpuFilter && !cpu.includes(cpuFilter)) return false;
    if (gpuFilter && !gpu.includes(gpuFilter)) return false;
    return true;
  });

  const data = assets.map((asset) => {
    const specs = (asset.specs as Record<string, string> | null) || {};
    return {
      assetTag: asset.assetTag,
      serialNumber: asset.serialNumber,
      category: asset.category?.name || '',
      manufacturer: asset.manufacturer || '',
      model: asset.model || '',
      ram: readSpec(specs, RAM_ALIASES),
      storage: readSpec(specs, STORAGE_ALIASES),
      processor: readSpec(specs, CPU_ALIASES),
      gpu: readSpec(specs, GPU_ALIASES),
      condition: asset.condition,
      company: asset.company?.name || '',
      location: asset.location?.name || '',
      assignedTo:
        asset.assignments && asset.assignments.length > 0
          ? `${asset.assignments[0].employee.firstName} ${asset.assignments[0].employee.lastName}`
          : asset.assignedToName || '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.toISOString().split('T')[0] : '',
      purchasePrice: asset.purchasePrice || '',
      warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.toISOString().split('T')[0] : '',
    };
  });

  const headers = [
    'assetTag',
    'serialNumber',
    'category',
    'manufacturer',
    'model',
    'ram',
    'storage',
    'processor',
    'gpu',
    'condition',
    'company',
    'location',
    'assignedTo',
    'purchaseDate',
    'purchasePrice',
    'warrantyExpiry',
  ];

  return { data, headers };
}

// Employees export handler
async function exportEmployees(
  searchParams: URLSearchParams
): Promise<{ data: any[]; headers: string[] }> {
  const departmentId = searchParams.get('departmentId')
    ? parseInt(searchParams.get('departmentId')!)
    : undefined;
  const companyId = searchParams.get('companyId')
    ? parseInt(searchParams.get('companyId')!)
    : undefined;
  const status = searchParams.get('status') || undefined;
  const activeOnly = searchParams.get('activeOnly') === 'true';

  const where: any = {};
  if (departmentId) where.departmentId = departmentId;
  if (companyId) where.companyId = companyId;
  if (status) where.employmentStatus = status;
  if (activeOnly) where.isActive = true;

  const employees = await prisma.employee.findMany({
    where,
    include: {
      department: true,
      company: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = employees.map((emp) => ({
    empCode: emp.empCode,
    firstName: emp.firstName,
    lastName: emp.lastName,
    department: emp.department.name,
    designation: emp.designation,
    company: emp.company?.name || '',
    location: '',
    employmentStatus: emp.employmentStatus,
    dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.toISOString().split('T')[0] : '',
    email: emp.email || '',
    phone: emp.phone || '',
  }));

  const headers = [
    'empCode',
    'firstName',
    'lastName',
    'department',
    'designation',
    'company',
    'location',
    'employmentStatus',
    'dateOfJoining',
    'email',
    'phone',
  ];

  return { data, headers };
}

// Expenses export handler
async function exportExpenses(
  searchParams: URLSearchParams
): Promise<{ data: any[]; headers: string[] }> {
  const companyId = searchParams.get('companyId')
    ? parseInt(searchParams.get('companyId')!)
    : undefined;
  const categoryId = searchParams.get('categoryId')
    ? parseInt(searchParams.get('categoryId')!)
    : undefined;
  const status = searchParams.get('status') || undefined;
  const departmentId = searchParams.get('departmentId')
    ? parseInt(searchParams.get('departmentId')!)
    : undefined;

  const where: any = {};
  if (companyId) where.companyId = companyId;
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  if (departmentId) where.departmentId = departmentId;

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      category: true,
      company: true,
      department: true,
      submittedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = expenses.map((exp) => ({
    expenseNumber: exp.expenseNumber,
    title: exp.description,
    amount: exp.amount,
    currency: exp.currency,
    category: exp.category.name,
    company: exp.company.name,
    department: exp.department?.name || '',
    status: exp.status,
    expenseDate: exp.expenseDate ? exp.expenseDate.toISOString().split('T')[0] : '',
    vendor: exp.vendor || '',
    paymentMethod: exp.paymentMethod || '',
  }));

  const headers = [
    'expenseNumber',
    'title',
    'amount',
    'currency',
    'category',
    'company',
    'department',
    'status',
    'expenseDate',
    'vendor',
    'paymentMethod',
  ];

  return { data, headers };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const mod = searchParams.get('module');
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    if (!mod || !['assets', 'employees', 'expenses'].includes(mod)) {
      return NextResponse.json({ error: 'Invalid module' }, { status: 400 });
    }

    let payload: { data: any[]; headers: string[] };
    switch (mod) {
      case 'assets':
        payload = await exportAssets(searchParams);
        break;
      case 'employees':
        payload = await exportEmployees(searchParams);
        break;
      case 'expenses':
        payload = await exportExpenses(searchParams);
        break;
      default:
        return NextResponse.json({ error: 'Invalid module' }, { status: 400 });
    }

    const timestamp = new Date().toISOString().split('T')[0];

    // ---- XLSX output ----
    if (format === 'xlsx') {
      // Lazy-import so the CSV path stays dependency-free
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(payload.data, { header: payload.headers });
      // Auto-size columns based on the widest cell in each column (capped).
      (ws as any)['!cols'] = payload.headers.map((h) => {
        const maxLen = Math.min(
          40,
          Math.max(
            h.length,
            ...payload.data.map((row) => String(row[h] ?? '').length)
          )
        );
        return { wch: maxLen + 2 };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, mod.slice(0, 31));
      const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new NextResponse(buf as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${mod}-export-${timestamp}.xlsx"`,
        },
      });
    }

    // ---- CSV output (default) ----
    const csv = arrayToCSV(payload.data, payload.headers);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${mod}-export-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
