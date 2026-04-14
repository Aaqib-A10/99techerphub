import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AssetFilters from '@/components/AssetFilters';
import ExportButton from '@/components/ExportButton';
import Pagination from '@/components/Pagination';
import AssetTable from './AssetTable';
import DateFilter from '@/app/components/DateFilter';

/**
 * Extract a spec value from the JSON blob using case-insensitive
 * matching on several common aliases (e.g. "RAM" vs "Memory").
 */
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
  // Partial-match fallback: if an alias is a substring of a key
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

const ALLOWED_PAGE_SIZES = new Set([25, 50, 100, 200, 500]);

// Opt out of static optimization — this page depends on live query strings.
export const dynamic = 'force-dynamic';

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // --------------------------------------------------------------
  // 1. Parse query params → filters + pagination
  // --------------------------------------------------------------
  const companyId = searchParams.companyId
    ? parseInt(searchParams.companyId as string)
    : undefined;
  const categoryId = searchParams.categoryId
    ? parseInt(searchParams.categoryId as string)
    : undefined;
  const employeeId = searchParams.employeeId
    ? parseInt(searchParams.employeeId as string)
    : undefined;
  const condition = searchParams.condition as string | undefined;
  const assignment = ((searchParams.assignment as string) || '').toLowerCase();

  const q = ((searchParams.q as string) || '').trim();
  const ramFilter = ((searchParams.ram as string) || '').trim().toLowerCase();
  const storageFilter = ((searchParams.storage as string) || '')
    .trim()
    .toLowerCase();
  const cpuFilter = ((searchParams.cpu as string) || '').trim().toLowerCase();
  const gpuFilter = ((searchParams.gpu as string) || '').trim().toLowerCase();

  // Pagination: supports numeric sizes + "all"
  const rawPageSize = (searchParams.pageSize as string) || '50';
  const pageSize: number | 'all' =
    rawPageSize === 'all'
      ? 'all'
      : ALLOWED_PAGE_SIZES.has(parseInt(rawPageSize))
        ? parseInt(rawPageSize)
        : 50;
  const page = Math.max(1, parseInt((searchParams.page as string) || '1') || 1);

  // --------------------------------------------------------------
  // 2. Build server-side Prisma where clause
  // --------------------------------------------------------------
  const where: any = {};
  if (companyId) where.companyId = companyId;
  if (categoryId) where.categoryId = categoryId;
  if (condition) where.condition = condition;
  // Assignment status — "assigned" = has at least one open assignment
  // (returnedDate = null). "unassigned" = no open assignment.
  // When filtering by specific employee, it implies "assigned" so we combine
  // both constraints rather than overwriting.
  if (employeeId) {
    // Specific employee filter implies assigned — use employee-specific query
    where.assignments = { some: { employeeId, returnedDate: null } };
  } else if (assignment === 'assigned') {
    // An asset is "assigned" if it has an open assignment record OR has a
    // legacy assignedToName value (from bulk-imported / migrated data that
    // pre-dates the assignments table).  Wrap in AND so this doesn't
    // collide with the search-term OR below.
    if (!where.AND) where.AND = [];
    where.AND.push({
      OR: [
        { assignments: { some: { returnedDate: null } } },
        { assignedToName: { not: null, notIn: ['', 'Available', 'available'] } },
      ],
    });
  } else if (assignment === 'unassigned') {
    // Unassigned means no open assignment AND no legacy holder name.
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

  // --------------------------------------------------------------
  // 3. Spec filters are JSON-based and must run in JS. We therefore
  //    fetch ALL matching ids+specs first, filter them, then re-fetch
  //    only the current page's rows with full relations. This keeps
  //    the heavy join off the "count everything" path.
  // --------------------------------------------------------------
  const hasSpecFilter = !!(ramFilter || storageFilter || cpuFilter || gpuFilter);

  const [companies, categories, activeEmployees, assignedEmployees] = await Promise.all([
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.assetCategory.findMany({ orderBy: { name: 'asc' } }),
    // Active employees
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, empCode: true },
      orderBy: { firstName: 'asc' }
    }),
    // Also include inactive employees who still have assets assigned
    prisma.employee.findMany({
      where: {
        isActive: false,
        assetAssignments: { some: { returnedDate: null } },
      },
      select: { id: true, firstName: true, lastName: true, empCode: true },
      orderBy: { firstName: 'asc' }
    }),
  ]);

  // Merge and deduplicate: active employees + exited employees with active assignments
  const employeeMap = new Map<number, typeof activeEmployees[0]>();
  for (const e of activeEmployees) employeeMap.set(e.id, e);
  for (const e of assignedEmployees) {
    if (!employeeMap.has(e.id)) employeeMap.set(e.id, e);
  }
  const employees = Array.from(employeeMap.values()).sort((a, b) =>
    a.firstName.localeCompare(b.firstName)
  );

  let filteredIds: number[] | null = null;
  let totalFiltered = 0;

  if (hasSpecFilter) {
    const specRows = await prisma.asset.findMany({
      where,
      select: { id: true, specs: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const kept = specRows.filter((a) => {
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
    filteredIds = kept.map((a) => a.id);
    totalFiltered = kept.length;
  } else {
    totalFiltered = await prisma.asset.count({ where });
  }

  // --------------------------------------------------------------
  // 4. Decide the page slice
  // --------------------------------------------------------------
  const effectivePageSize = pageSize === 'all' ? totalFiltered || 1 : pageSize;
  const totalPages =
    pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalFiltered / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const skip = pageSize === 'all' ? 0 : (safePage - 1) * effectivePageSize;
  const take = pageSize === 'all' ? undefined : effectivePageSize;

  // --------------------------------------------------------------
  // 5. Fetch the page rows with relations
  // --------------------------------------------------------------
  let pageWhere: any = where;
  if (hasSpecFilter && filteredIds) {
    const sliceIds =
      pageSize === 'all'
        ? filteredIds
        : filteredIds.slice(skip, skip + effectivePageSize);
    pageWhere = { id: { in: sliceIds } };
  }

  const assetsRaw = await prisma.asset.findMany({
    where: pageWhere,
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
    ...(hasSpecFilter ? {} : { skip, take }),
  });

  // Decorate with derived spec cells for the table
  const assets = assetsRaw.map((a) => {
    const specs = (a.specs as Record<string, string> | null) || {};
    return {
      ...a,
      _ram: readSpec(specs, RAM_ALIASES),
      _storage: readSpec(specs, STORAGE_ALIASES),
      _cpu: readSpec(specs, CPU_ALIASES),
      _gpu: readSpec(specs, GPU_ALIASES),
    };
  });

  return (
    <div style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', color: '#0B1C30' }}>
      {/* Hero header — Architectural Ledger style */}
      <div
        className="mb-8 pb-6 flex flex-wrap items-center justify-between gap-4"
        style={{ borderBottom: '1px solid rgba(196,198,206,0.3)' }}
      >
        <div className="flex items-start gap-4">
          {/* Ledger Line accent */}
          <div style={{ width: 2, height: 56, backgroundColor: '#14B8A6' }} />
          <div>
            <p
              className="text-[11px] font-bold uppercase mb-2"
              style={{
                color: '#75777E',
                letterSpacing: '0.12em',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}
            >
              Asset Management
            </p>
            <h1
              className="text-4xl font-black tracking-tighter leading-none"
              style={{ color: '#0B1F3A' }}
            >
              Assets List
            </h1>
            <p className="mt-2 text-sm" style={{ color: '#44474D' }}>
              Track every device, scan QR labels, and assign hardware to employees.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/assets/scan"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              border: '1px solid rgba(196,198,206,0.4)',
              color: '#0B1C30',
              backgroundColor: '#FFFFFF',
            }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h4V4H4v2zm0 6h4v-2H4v2zm0 6h4v-2H4v2zm6-12h10V4H10v2zm0 6h10v-2H10v2zm0 6h10v-2H10v2z" />
            </svg>
            Scan Asset
          </Link>
          <Link
            href="/assets/import"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              border: '1px solid rgba(196,198,206,0.4)',
              color: '#0B1C30',
              backgroundColor: '#FFFFFF',
            }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" />
            </svg>
            Bulk Import
          </Link>
          <Link
            href="/assets/new"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all active:scale-95"
            style={{ backgroundColor: '#0B1F3A', color: '#FFFFFF' }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Asset
          </Link>
        </div>
      </div>

      {/* Date Filter */}
      <div className="mb-6 flex justify-end">
        <DateFilter />
      </div>

      {/* Filters - Client Component */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <AssetFilters
            companies={companies.map((c) => ({ id: c.id, name: c.name }))}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, empCode: e.empCode }))}
          />
        </div>
        <ExportButton
          module="assets"
          filters={{
            companyId: (searchParams.companyId as string) || '',
            categoryId: (searchParams.categoryId as string) || '',
            condition: (searchParams.condition as string) || '',
            assignment: assignment || '',
            employeeId: (searchParams.employeeId as string) || '',
            q: q || '',
            ram: ramFilter || '',
            storage: storageFilter || '',
            cpu: cpuFilter || '',
            gpu: gpuFilter || '',
          }}
        />
      </div>

      {/* Assets Table — Ledger style */}
      <div
        className="overflow-hidden rounded-xl"
        style={{
          backgroundColor: '#FFFFFF',
          boxShadow: '0 8px 16px -6px rgba(11, 31, 58, 0.06)',
        }}
      >
        <AssetTable assets={JSON.parse(JSON.stringify(assets))} />

        {/* Pagination footer */}
        <Pagination
          page={safePage}
          pageSize={pageSize}
          total={totalFiltered}
          showing={assets.length}
        />
      </div>
    </div>
  );
}
