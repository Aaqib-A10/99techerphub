import { prisma } from '@/lib/prisma';

/**
 * Generate the next employee ID for a department.
 * Uses a PostgreSQL advisory lock keyed on the department code hash
 * to serialize concurrent ID generation.
 */
export async function generateEmployeeId(departmentCode: string): Promise<string> {
  if (!departmentCode?.trim()) {
    throw new Error('Department code is required to generate employee ID');
  }

  const code = departmentCode.toUpperCase().trim();

  // Use an advisory lock keyed on a hash of the department code
  // to serialize concurrent ID generation for the same department
  const lockKey = hashCode(code);

  const result = await prisma.$transaction(async (tx) => {
    // Acquire advisory lock (released at end of transaction)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    // Find the current max code for this department
    const existing = await tx.employee.findMany({
      where: { empCode: { startsWith: code } },
      select: { empCode: true },
      orderBy: { empCode: 'desc' },
      take: 1,
    });

    let nextNum = 1;
    if (existing.length > 0 && existing[0].empCode) {
      const parts = existing[0].empCode.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }

    return `${code}-${String(nextNum).padStart(3, '0')}`;
  });

  return result;
}

/** Simple string hash to use as advisory lock key */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
