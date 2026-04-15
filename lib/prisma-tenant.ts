import { prisma } from '@/lib/prisma';

/**
 * Models that have a direct `companyId` field and should be
 * automatically filtered by the caller's accessible companies.
 */
const TENANT_MODELS = [
  'asset',
  'expense',
  'payrollRun',
  'billingSplit',
  'monthlyReport',
] as const;

type TenantModel = (typeof TENANT_MODELS)[number];

function isTenantModel(model: string): model is TenantModel {
  return TENANT_MODELS.includes(model as TenantModel);
}

/**
 * Returns a Prisma client extended with automatic tenant filtering.
 *
 * Every findMany / findFirst on a tenant model injects
 *   `companyId: { in: companyIds }` into the WHERE clause.
 *
 * findUnique / update / delete perform a post-fetch ownership check
 * and throw if the record doesn't belong to one of the caller's companies.
 */
export function tenantPrisma(companyIds: number[]) {
  if (companyIds.length === 0) {
    throw new Error('tenantPrisma requires at least one companyId');
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = {
              ...args.where,
              companyId: { in: companyIds },
            };
          }
          return query(args);
        },

        async findFirst({ model, args, query }) {
          if (isTenantModel(model)) {
            args.where = {
              ...args.where,
              companyId: { in: companyIds },
            };
          }
          return query(args);
        },

        async findUnique({ model, args, query }) {
          const result = await query(args);
          if (result && isTenantModel(model)) {
            const record = result as Record<string, unknown>;
            if (
              record.companyId != null &&
              !companyIds.includes(record.companyId as number)
            ) {
              return null; // hide record that doesn't belong to caller
            }
          }
          return result;
        },

        async update({ model, args, query }) {
          if (isTenantModel(model)) {
            // Pre-check ownership before allowing mutation
            const existing = await (prisma as any)[model].findUnique({
              where: args.where,
              select: { companyId: true },
            });
            if (
              existing?.companyId != null &&
              !companyIds.includes(existing.companyId as number)
            ) {
              throw new Error(
                `TENANT_VIOLATION: Cannot update ${model} belonging to company ${existing.companyId}`
              );
            }
          }
          return query(args);
        },

        async delete({ model, args, query }) {
          if (isTenantModel(model)) {
            const existing = await (prisma as any)[model].findUnique({
              where: args.where,
              select: { companyId: true },
            });
            if (
              existing?.companyId != null &&
              !companyIds.includes(existing.companyId as number)
            ) {
              throw new Error(
                `TENANT_VIOLATION: Cannot delete ${model} belonging to company ${existing.companyId}`
              );
            }
          }
          return query(args);
        },
      },
    },
  });
}
