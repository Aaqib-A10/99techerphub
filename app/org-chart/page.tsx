import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import OrgTree, { OrgNode } from './OrgTree';
import PageHero from '@/app/components/PageHero';

export const dynamic = 'force-dynamic';

const ORG_VIEW_ROLES = new Set(['ADMIN', 'HR', 'MANAGER', 'FINANCE']);

interface RawEmployee {
  id: number;
  empCode: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  reportingManagerId: number | null;
  departmentName: string | null;
  photoUrl: string | null;
  activeAssetCount: number;
}

/**
 * Build a tree from a flat employee list.
 * Returns nodes whose `reportsTo` matches the given parentId.
 */
function buildTree(rows: RawEmployee[], parentId: number | null): OrgNode[] {
  return rows
    .filter((r) => r.reportingManagerId === parentId)
    .map<OrgNode>((r) => ({
      id: r.id,
      empCode: r.empCode,
      firstName: r.firstName,
      lastName: r.lastName,
      designation: r.designation,
      departmentName: r.departmentName,
      photoUrl: r.photoUrl,
      activeAssetCount: r.activeAssetCount,
      reports: buildTree(rows, r.id),
    }));
}

/** Walk up the chain from `start` collecting manager → manager → ... */
function buildAncestry(rows: RawEmployee[], startId: number): OrgNode[] {
  const map = new Map(rows.map((r) => [r.id, r]));
  const chain: OrgNode[] = [];
  let cur = map.get(startId);
  while (cur && cur.reportingManagerId) {
    const parent = map.get(cur.reportingManagerId);
    if (!parent) break;
    chain.unshift({
      id: parent.id,
      empCode: parent.empCode,
      firstName: parent.firstName,
      lastName: parent.lastName,
      designation: parent.designation,
      departmentName: parent.departmentName,
      photoUrl: parent.photoUrl,
      activeAssetCount: parent.activeAssetCount,
      reports: [],
    });
    cur = parent;
  }
  return chain;
}

export default async function OrgChartPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="text-center py-16 text-gray-600">
        Sign in to see the organization chart.
      </div>
    );
  }

  // Pull every active employee — small enough (~280) to fit in memory once
  const rawList = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      designation: true,
      reportingManagerId: true,
      photoUrl: true,
      department: { select: { name: true } },
      _count: {
        select: {
          assetAssignments: { where: { returnedDate: null } },
        },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const rows: RawEmployee[] = rawList.map((r) => ({
    id: r.id,
    empCode: r.empCode,
    firstName: r.firstName,
    lastName: r.lastName,
    designation: r.designation,
    reportingManagerId: r.reportingManagerId,
    photoUrl: r.photoUrl,
    departmentName: r.department?.name ?? null,
    activeAssetCount: r._count.assetAssignments,
  }));

  // Decide what tree to show
  const isOrgWide = ORG_VIEW_ROLES.has(user.role);
  let roots: OrgNode[];
  let ancestry: OrgNode[] = [];
  let focusEmployeeId: number | null = null;

  if (isOrgWide) {
    // Full org: start from people with no manager
    roots = buildTree(rows, null);
  } else if (user.employeeId) {
    // Personal view: ancestry above (manager chain) + own subtree
    focusEmployeeId = user.employeeId;
    const me = rows.find((r) => r.id === user.employeeId);
    if (!me) {
      return (
        <div className="text-center py-16 text-gray-600">
          We can&apos;t find your employee record.
        </div>
      );
    }
    ancestry = buildAncestry(rows, me.id);
    roots = [
      {
        id: me.id,
        empCode: me.empCode,
        firstName: me.firstName,
        lastName: me.lastName,
        designation: me.designation,
        departmentName: me.departmentName,
        photoUrl: me.photoUrl,
        activeAssetCount: me.activeAssetCount,
        reports: buildTree(rows, me.id),
      },
    ];
  } else {
    roots = [];
  }

  return (
    <div>
      <PageHero
        eyebrow="People"
        title="Organization Chart"
        description={
          isOrgWide
            ? 'Top-down view of the entire active org.'
            : 'Your reporting line up to leadership and your direct reports below.'
        }
      />
      <OrgTree
        roots={roots}
        ancestry={ancestry}
        focusEmployeeId={focusEmployeeId}
        searchable={isOrgWide}
        totalActive={rows.length}
      />
    </div>
  );
}
