import { prisma } from '@/lib/prisma';

export async function generateEmployeeId(departmentCode: string): Promise<string> {
  if (!departmentCode) {
    throw new Error('Department code is required');
  }

  // Normalize department code to uppercase
  const normalizedCode = departmentCode.toUpperCase();

  // Query for the maximum employee code that starts with the department code
  const maxEmpCode = await prisma.employee.findFirst({
    where: {
      empCode: {
        startsWith: `${normalizedCode}-`,
      },
    },
    orderBy: {
      empCode: 'desc',
    },
    select: {
      empCode: true,
    },
  });

  let nextNumber = 1;

  if (maxEmpCode && maxEmpCode.empCode) {
    // Parse the numeric part from the existing code (e.g., "DEV-042" -> 42)
    const parts = maxEmpCode.empCode.split('-');
    if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
      nextNumber = parseInt(parts[1]) + 1;
    }
  }

  // Format: Department code + zero-padded number (e.g., "DEV-042")
  const paddedNumber = String(nextNumber).padStart(3, '0');
  return `${normalizedCode}-${paddedNumber}`;
}
