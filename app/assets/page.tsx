import { prisma } from '@/lib/prisma';
import AssetFilters from '@/components/AssetFilters';
import ExportButton from '@/components/ExportButton';
import Pagination from '@/components/Pagination';
import AssetTable from './AssetTable';
import DateFilter from '@/app/components/DateFilter';
import SplitButton from '@/app/components/SplitButton';
import { KpiTile, Card } from '@/app/components/design';
import { ASSET_ROLES, requireRoleOrRedirect } from '@/lib/auth';

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
  // Asset directory is admin/HR/manager/finance only. Employees see
  // their own assigned assets through the EmployeeDashboard widget — they
  // never need to browse the org-wide list.
  await requireRoleOrRedirect(ASSET_ROLES);

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
  const overdueOnly = (searchParams.overdue as string) === '1';

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
  // 2. Build server-side Prisma where clauses
  //
  // `scopedWhere` carries only the "scope" filters — company,
  // location, category, type, employee, search, specs. These narrow
  // the KPI tile counts so the tiles reflect the user's current view
  // (clicking SJ Computers shouldn't leave the strip showing org-wide
  // totals — that was the user-reported bug).
  //
  // `where` is the full filter the table uses: scope plus the
  // status selectors (assignment / condition / overdue) that the KPI
  // tiles themselves toggle. Keeping those out of scopedWhere is
  // what makes "Total / Assigned / Available / In Repair / Retired"
  // add up consistently within the same scope, regardless of which
  // tile is currently active.
  // --------------------------------------------------------------
  const scopedWhere: any = {};
  if (companyId) scopedWhere.companyId = companyId;
  if (locationId) scopedWhere.locationId = locationId;
  if (categoryId) scopedWhere.categoryId = categoryId;
  if (assetType) scopedWhere.category = { assetType };
  if (q) {
    scopedWhere.OR = [
      { assetTag: { contains: q, mode: 'insensitive' } },
      { serialNumber: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
      { manufacturer: { contains: q, mode: 'insensitive' } },
      { assignedToName: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
    ];
  }

  const where: any = { ...scopedWhere };
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
  // Overdue = open assignment older than 180 days. Mirrors the count
  // computed by the dashboard "Overdue returns" tile.
  if (overdueOnly) {
    if (!where.AND) where.AND = [];
    where.AND.push({
      assignments: {
        some: {
          returnedDate: null,
          assignedDate: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
        },
      },
    });
  }
  // q (search) is already on scopedWhere → flows into `where` via the
  // earlier spread, so no duplicate handling needed here.

  // --------------------------------------------------------------
  // 3. Spec filters are JSON-based and must run in JS. We therefore
  //    fetch ALL matching ids+specs first, filter them, then re-fetch
  //    only the current page's rows with full relations. This keeps
  //    the heavy join off the "count everything" path.
  // --------------------------------------------------------------
  const hasSpecFilter = !!(ramFilter || storageFilter || cpuFilter || gpuFilter);

  // KPI status clauses — composed with scopedWhere so the strip
  // reflects the current scope (company / location / category /
  // search) rather than the org-wide pool.
  const ASSIGNED_LEGACY_OR_OPEN: any = {
    OR: [
      { assignments: { some: { returnedDate: null } } },
      { assignedToName: { not: null, notIn: ['', 'Available', 'available'] } },
    ],
  };
  const UNASSIGNED_AND_NOT_TIED_UP: any = {
    AND: [
      { assignments: { none: { returnedDate: null } } },
      {
        OR: [
          { assignedToName: null },
          { assignedToName: { in: ['', 'Available', 'available'] } },
        ],
      },
      { condition: { notIn: ['IN_REPAIR', 'RETIRED', 'LOST'] } },
    ],
  };

  const [
    companies,
    locations,
    categories,
    activeEmployees,
    assignedEmployees,
    totalAssetCount,
    assignedCount,
    availableCount,
    inRepairCount,
    retiredCount,
    valueAgg,
  ] = await Promise.all([
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
    prisma.asset.count({ where: scopedWhere }),
    prisma.asset.count({ where: { AND: [scopedWhere, ASSIGNED_LEGACY_OR_OPEN] } }),
    prisma.asset.count({ where: { AND: [scopedWhere, UNASSIGNED_AND_NOT_TIED_UP] } }),
    prisma.asset.count({
      where: { AND: [scopedWhere, { condition: 'IN_REPAIR' }] },
    }),
    prisma.asset.count({
      where: { AND: [scopedWhere, { condition: 'RETIRED' }] },
    }),
    prisma.asset.aggregate({
      _sum: { purchasePrice: true },
      where: scopedWhere,
    }),
  ]);

  const totalValue = Number(valueAgg._sum.purchasePrice ?? 0);
  const utilization =
    totalAssetCount > 0 ? Math.round((assignedCount / totalAssetCount) * 100) : 0;

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

  const valueLabel = totalValue.toLocaleString('en-US', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  });

  // Build a /assets URL that preserves the current scope filters and
  // overrides only the status selectors a KPI tile owns. `assignment`
  // and `condition` are mutually exclusive on the tile click — tapping
  // "In Repair" should clear any active assignment filter and vice
  // versa, otherwise the new tile's count won't match the table.
  function kpiHref(overrides: {
    assignment?: 'assigned' | 'unassigned' | null;
    condition?: string | null;
  }) {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationId) params.set('locationId', String(locationId));
    if (categoryId) params.set('categoryId', String(categoryId));
    if (assetType) params.set('assetType', assetType);
    if (q) params.set('q', q);
    if (ramFilter) params.set('ram', ramFilter);
    if (storageFilter) params.set('storage', storageFilter);
    if (cpuFilter) params.set('cpu', cpuFilter);
    if (gpuFilter) params.set('gpu', gpuFilter);
    if (overrides.assignment) params.set('assignment', overrides.assignment);
    if (overrides.condition) params.set('condition', overrides.condition);
    const qs = params.toString();
    return qs ? `/assets?${qs}` : '/assets';
  }

  return (
    <div>
      {/* Page header — design system aesthetic */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            Inventory · Hardware
          </div>
          <h1
            className="text-[22px] font-semibold leading-tight text-core-text"
            style={{ letterSpacing: '-0.018em' }}
          >
            All Assets
          </h1>
          <p className="mt-[2px] text-[13px] text-core-text2">
            {totalAssetCount.toLocaleString()} items across {categories.length} categories — total value {valueLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      {/* KPI strip — clickable tiles. Each tile carries the current
          scope filters (company/location/category/search) and toggles
          the assignment/condition selector to its own slice, so the
          user can pivot the table view by tapping a tile. */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          tone="blue"
          label="Total Assets"
          value={totalAssetCount.toLocaleString()}
          meta={`${valueLabel} value`}
          href={kpiHref({})}
        />
        <KpiTile
          tone="green"
          label="Assigned"
          value={assignedCount.toLocaleString()}
          meta={`${utilization}% utilization`}
          href={kpiHref({ assignment: 'assigned' })}
        />
        <KpiTile
          tone="violet"
          label="Available"
          value={availableCount.toLocaleString()}
          href={kpiHref({ assignment: 'unassigned' })}
        />
        <KpiTile
          tone="amber"
          label="In Repair"
          value={inRepairCount.toLocaleString()}
          href={kpiHref({ condition: 'IN_REPAIR' })}
        />
        <KpiTile
          tone="rose"
          label="Retired"
          value={retiredCount.toLocaleString()}
          href={kpiHref({ condition: 'RETIRED' })}
        />
      </div>

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
              overdue: overdueOnly ? '1' : '',
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
      <Card
        title="All Assets"
        subtitle={`Showing ${assets.length} of ${totalFiltered.toLocaleString()} records`}
        padded={false}
      >
        <AssetTable assets={JSON.parse(JSON.stringify(assets))} />
        <Pagination
          page={safePage}
          pageSize={pageSize}
          total={totalFiltered}
          showing={assets.length}
        />
      </Card>
    </div>
  );
}
