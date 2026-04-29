import { prisma } from '@/lib/prisma';
import AssetFilters from '@/components/AssetFilters';
import ExportButton from '@/components/ExportButton';
import Pagination from '@/components/Pagination';
import AssetTable from './AssetTable';
import DateFilter from '@/app/components/DateFilter';
import PageHero from '@/app/components/PageHero';
import SplitButton from '@/app/components/SplitButton';

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
  const locationId = searchParams.locationId
    ? parseInt(searchParams.locationId as string)
    : undefined;
  const categoryId = searchParams.categoryId
    ? parseInt(searchParams.categoryId as string)
    : undefined;
  const employeeId = searchParams.employeeId
    ? parseInt(searchParams.employeeId as string)
    : undefined;
  const condition = searchParams.condition as string | undefined;
  const assetType = searchParams.assetType as string | undefined;
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
  if (locationId) where.locationId = locationId;
  if (categoryId) where.categoryId = categoryId;
  if (assetType) where.category = { assetType };
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

  const [companies, locations, categories, activeEmployees, assignedEmployees] = await Promise.all([
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
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
    <div>
      <PageHero
        eyebrow="Asset Management"
        title="Assets"
        description="Track every device, scan QR labels, and assign hardware to employees."
        actions={
          <SplitButton
            primary={{
              label: 'Add Asset',
              href: '/assets/new',
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14 M5 12h14" />
                </svg>
              ),
            }}
            actions={[
              {
                label: 'Scan Asset',
                href: '/assets/scan',
                description: 'Scan a QR label with the camera',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 012-2h2 M17 3h2a2 2 0 012 2v2 M21 17v2a2 2 0 01-2 2h-2 M7 21H5a2 2 0 01-2-2v-2 M7 12h10" />
                  </svg>
                ),
              },
              {
                label: 'Bulk Import',
                href: '/assets/import',
                description: 'Import assets from a CSV or Excel file',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12" />
                  </svg>
                ),
              },
            ]}
          />
        }
      />

      {/* Compact toolbar — chip filters live inside AssetFilters; date + export sit on the right */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0">
          <AssetFilters
            companies={companies.map((c) => ({ id: c.id, name: c.name }))}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, empCode: e.empCode }))}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <DateFilter />
          <ExportButton
            module="assets"
            filters={{
              companyId: (searchParams.companyId as string) || '',
              locationId: (searchParams.locationId as string) || '',
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
      </div>

      {/* Assets Table */}
      <div className="overflow-hidden rounded-lg bg-white border border-zinc-200/85 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <AssetTable assets={JSON.parse(JSON.stringify(assets))} />
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
