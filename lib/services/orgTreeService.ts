import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Org-tree service: source of truth for "who reports to whom, and since when".
 *
 * Two reads (subtree, ancestors) and two writes (assignManager, unassignManager)
 * cover Phase 1. All reads accept an `asOf` to support historical / "as of date"
 * views. Writes are transactional and keep `Employee.reportingManagerId` in sync
 * as a denormalized cache of the current SOLID-line manager.
 *
 * Invariants (enforced here, not via DB constraints):
 *   - At most one OPEN row (validTo IS NULL) per (employeeId, relationshipType).
 *   - validFrom <= validTo when validTo is non-null.
 *   - An employee cannot be their own manager (self-loop check on write).
 *
 * Cycle protection on reads: recursive CTEs are capped at MAX_TREE_DEPTH so a
 * malformed dotted-line graph (A → B and B → A) can't run away.
 */

const MAX_TREE_DEPTH = 50;

export type RelationshipType = 'SOLID' | 'DOTTED';

export interface SubtreeRow {
  employeeId: number;
  managerId: number;
  relationshipType: RelationshipType;
  depth: number;
}

export interface AncestorRow {
  employeeId: number;
  managerId: number;
  relationshipType: RelationshipType;
  depth: number;
}

interface ReadOptions {
  asOf?: Date;
  includeDotted?: boolean;
  maxDepth?: number;
}

interface WriteOptions {
  type?: RelationshipType;
  effectiveFrom?: Date;
  by?: number; // userId of the actor
  reason?: string;
}

// ---------------------------------------------------------------------------
// READ: subtree (everyone reporting up to `rootId`, transitively)
// ---------------------------------------------------------------------------
export async function getSubtree(
  rootId: number,
  opts: ReadOptions = {}
): Promise<SubtreeRow[]> {
  const asOf = opts.asOf ?? new Date();
  const includeDotted = opts.includeDotted ?? false;
  const maxDepth = Math.min(opts.maxDepth ?? MAX_TREE_DEPTH, MAX_TREE_DEPTH);

  return prisma.$queryRaw<SubtreeRow[]>`
    WITH RECURSIVE descendants AS (
      SELECT
        a."employeeId"               AS "employeeId",
        a."managerId"                AS "managerId",
        a."relationshipType"::text   AS "relationshipType",
        1                            AS depth
      FROM "org_assignments" a
      WHERE a."managerId" = ${rootId}
        AND a."validFrom" <= ${asOf}
        AND (a."validTo" IS NULL OR a."validTo" > ${asOf})
        AND (${includeDotted}::boolean OR a."relationshipType"::text = 'SOLID')

      UNION ALL

      SELECT
        a."employeeId"               AS "employeeId",
        a."managerId"                AS "managerId",
        a."relationshipType"::text   AS "relationshipType",
        d.depth + 1                  AS depth
      FROM "org_assignments" a
      INNER JOIN descendants d ON a."managerId" = d."employeeId"
      WHERE a."validFrom" <= ${asOf}
        AND (a."validTo" IS NULL OR a."validTo" > ${asOf})
        AND (${includeDotted}::boolean OR a."relationshipType"::text = 'SOLID')
        AND d.depth < ${maxDepth}
    )
    SELECT "employeeId", "managerId", "relationshipType", depth FROM descendants
    ORDER BY depth ASC, "employeeId" ASC
  `;
}

// ---------------------------------------------------------------------------
// READ: ancestors (the manager chain above `employeeId`)
// ---------------------------------------------------------------------------
export async function getAncestors(
  employeeId: number,
  opts: ReadOptions = {}
): Promise<AncestorRow[]> {
  const asOf = opts.asOf ?? new Date();
  const includeDotted = opts.includeDotted ?? false;
  const maxDepth = Math.min(opts.maxDepth ?? MAX_TREE_DEPTH, MAX_TREE_DEPTH);

  return prisma.$queryRaw<AncestorRow[]>`
    WITH RECURSIVE ancestors AS (
      SELECT
        a."employeeId"               AS "employeeId",
        a."managerId"                AS "managerId",
        a."relationshipType"::text   AS "relationshipType",
        1                            AS depth
      FROM "org_assignments" a
      WHERE a."employeeId" = ${employeeId}
        AND a."validFrom" <= ${asOf}
        AND (a."validTo" IS NULL OR a."validTo" > ${asOf})
        AND (${includeDotted}::boolean OR a."relationshipType"::text = 'SOLID')

      UNION ALL

      SELECT
        a."employeeId"               AS "employeeId",
        a."managerId"                AS "managerId",
        a."relationshipType"::text   AS "relationshipType",
        c.depth + 1                  AS depth
      FROM "org_assignments" a
      INNER JOIN ancestors c ON a."employeeId" = c."managerId"
      WHERE a."validFrom" <= ${asOf}
        AND (a."validTo" IS NULL OR a."validTo" > ${asOf})
        AND (${includeDotted}::boolean OR a."relationshipType"::text = 'SOLID')
        AND c.depth < ${maxDepth}
    )
    SELECT "employeeId", "managerId", "relationshipType", depth FROM ancestors
    ORDER BY depth ASC
  `;
}

// ---------------------------------------------------------------------------
// WRITE: assignManager — close the open row (if any) and insert a new one.
// Updates Employee.reportingManagerId cache when the new row is SOLID.
// ---------------------------------------------------------------------------
export async function assignManager(
  employeeId: number,
  managerId: number,
  opts: WriteOptions = {}
): Promise<void> {
  if (employeeId === managerId) {
    throw new Error(`assignManager: employee ${employeeId} cannot manage themselves`);
  }

  const type: RelationshipType = opts.type ?? 'SOLID';
  const effectiveFrom = opts.effectiveFrom ?? new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Close any currently-open assignment of the same type.
    await tx.orgAssignment.updateMany({
      where: {
        employeeId,
        relationshipType: type,
        validTo: null,
      },
      data: { validTo: effectiveFrom },
    });

    // 2. Insert the new open row.
    await tx.orgAssignment.create({
      data: {
        employeeId,
        managerId,
        relationshipType: type,
        validFrom: effectiveFrom,
        validTo: null,
        reason: opts.reason ?? null,
        createdById: opts.by ?? null,
      },
    });

    // 3. SOLID-only: update the denormalized cache on Employee.
    if (type === 'SOLID') {
      await tx.employee.update({
        where: { id: employeeId },
        data: { reportingManagerId: managerId },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// WRITE: unassignManager — close the open row of `type` without inserting one.
// Used when an employee leaves, or a dotted line is dropped.
// ---------------------------------------------------------------------------
export async function unassignManager(
  employeeId: number,
  opts: { type?: RelationshipType; effectiveFrom?: Date } = {}
): Promise<void> {
  const type: RelationshipType = opts.type ?? 'SOLID';
  const effectiveFrom = opts.effectiveFrom ?? new Date();

  await prisma.$transaction(async (tx) => {
    await tx.orgAssignment.updateMany({
      where: {
        employeeId,
        relationshipType: type,
        validTo: null,
      },
      data: { validTo: effectiveFrom },
    });

    if (type === 'SOLID') {
      await tx.employee.update({
        where: { id: employeeId },
        data: { reportingManagerId: null },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Convenience: the set of subordinate employee IDs (for permission scoping).
// ---------------------------------------------------------------------------
export async function getSubordinateIds(
  rootId: number,
  opts: ReadOptions = {}
): Promise<Set<number>> {
  const rows = await getSubtree(rootId, opts);
  return new Set(rows.map((r) => r.employeeId));
}

// Re-export the Prisma type for callers that need to compose more complex queries.
export type { Prisma };
