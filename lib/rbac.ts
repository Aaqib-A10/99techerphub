import { UserRole } from '@prisma/client';
import { getSessionUser } from '@/lib/auth';

/**
 * Permission matrix for role-based access control
 *
 * Roles:
 *   ADMIN      — Full system access
 *   HR         — Employee lifecycle, onboarding, offer letters, assets
 *   MANAGER    — Department-level view of employees, assets, expenses
 *   ACCOUNTANT — Finance, payroll, expenses, reports, billing
 *   EMPLOYEE   — Self-service only (own profile, own expenses)
 */
export const PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ['*'], // All permissions
  HR: [
    'employees:*',
    'assets:*',
    'digital-access:*',
    'onboarding:*',
    'offer-letters:*',
    'master-data:read',
  ],
  MANAGER: [
    'employees:read',
    'assets:read',
    'expenses:*',
    'digital-access:read',
  ],
  ACCOUNTANT: [
    'expenses:*',
    'finance:*',
    'reports:*',
    'payroll:*',
    'billing:*',
    'employees:read',
  ],
  EMPLOYEE: [
    'self:read',
    'self:update',
    'expenses:create',
    'expenses:own',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const rolePermissions = PERMISSIONS[role];

  // Wildcard: ADMIN has everything
  if (rolePermissions.includes('*')) {
    return true;
  }

  // Direct match
  if (rolePermissions.includes(permission)) {
    return true;
  }

  // Wildcard match (e.g., "employees:*" matches "employees:read")
  const permissionParts = permission.split(':');
  if (permissionParts.length === 2) {
    const wildcard = `${permissionParts[0]}:*`;
    if (rolePermissions.includes(wildcard)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the current user's permissions
 */
export async function getUserPermissions(): Promise<string[]> {
  const user = await getSessionUser();
  if (!user) return [];
  return PERMISSIONS[user.role] || [];
}

/**
 * Check if the current user has a specific permission
 */
export async function currentUserHasPermission(permission: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  return hasPermission(user.role, permission);
}

/**
 * Require a specific permission (throws if missing)
 */
export async function requirePermission(permission: string): Promise<void> {
  const has = await currentUserHasPermission(permission);
  if (!has) {
    throw new Error(`Forbidden: Required permission: ${permission}`);
  }
}
