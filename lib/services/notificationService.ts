import { prisma } from '@/lib/prisma';
import { NotificationType, UserRole } from '@prisma/client';

interface CreateNotificationOptions {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Create a notification for a single user
 */
export async function createNotification(
  options: CreateNotificationOptions
): Promise<any> {
  return prisma.notification.create({
    data: {
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      link: options.link,
    },
  });
}

/**
 * Create notifications for all users with a specific role
 */
export async function createNotificationsForRole(
  role: UserRole,
  options: Omit<CreateNotificationOptions, 'userId'>
): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      role,
      isActive: true,
    },
    select: { id: true },
  });

  for (const user of users) {
    await createNotification({
      ...options,
      userId: user.id,
    });
  }
}

/**
 * Check for employee birthdays and create notifications
 */
export async function checkBirthdaysAndAnniversaries(): Promise<number> {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const monthDay = `${month}-${day}`;

  // Find employees with birthdays today
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      dateOfBirth: {
        not: null,
      },
    },
    select: {
      id: true,
      firstName: true,
      dateOfBirth: true,
      user: { select: { id: true } },
    },
  });

  let count = 0;
  for (const emp of employees) {
    if (emp.dateOfBirth) {
      const empMonthDay = emp.dateOfBirth
        .toISOString()
        .slice(5, 10)
        .replace('T', '');

      if (empMonthDay === monthDay) {
        // Create notification for admins
        await createNotificationsForRole(UserRole.ADMIN, {
          type: 'GENERAL' as NotificationType,
          title: 'Employee Birthday',
          message: `${emp.firstName}'s birthday today!`,
        });
        count++;
      }
    }
  }

  return count;
}

/**
 * Check for employees with ending probation periods
 */
export async function checkProbationEnding(): Promise<number> {
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      probationEndDate: {
        lte: inSevenDays,
        gte: new Date(),
      },
    },
    select: {
      id: true,
      firstName: true,
      probationEndDate: true,
    },
  });

  for (const emp of employees) {
    await createNotificationsForRole(UserRole.HR, {
      type: 'SYSTEM_ALERT' as NotificationType,
      title: 'Probation Period Ending',
      message: `${emp.firstName}'s probation period ends on ${emp.probationEndDate?.toLocaleDateString()}`,
      link: `/employees/${emp.id}`,
    });
  }

  return employees.length;
}

/**
 * Check for contracts expiring soon
 */
export async function checkContractExpiry(): Promise<number> {
  const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      employmentStatus: 'CONSULTANT',
      dateOfLeaving: {
        lte: inThirtyDays,
        gte: new Date(),
      },
    },
    select: {
      id: true,
      firstName: true,
      dateOfLeaving: true,
    },
  });

  for (const emp of employees) {
    await createNotificationsForRole(UserRole.HR, {
      type: 'SYSTEM_ALERT' as NotificationType,
      title: 'Consultant Contract Expiring',
      message: `${emp.firstName}'s contract expires on ${emp.dateOfLeaving?.toLocaleDateString()}`,
      link: `/employees/${emp.id}`,
    });
  }

  return employees.length;
}

/**
 * Check for pending expenses awaiting approval
 */
export async function checkPendingExpenses(): Promise<number> {
  const pendingExpenses = await prisma.expense.findMany({
    where: {
      status: 'PENDING',
    },
    select: {
      id: true,
      submittedBy: { select: { firstName: true } },
      amount: true,
    },
  });

  if (pendingExpenses.length > 0) {
    const total = pendingExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    await createNotificationsForRole(UserRole.FINANCE, {
      type: 'EXPENSE_SUBMITTED' as NotificationType,
      title: 'Pending Expenses',
      message: `${pendingExpenses.length} expense(s) awaiting approval (Total: PKR ${total.toFixed(2)})`,
      link: '/expenses',
    });
  }

  return pendingExpenses.length;
}

/**
 * Run all notification checks (called by scheduler)
 */
export async function runAllChecks(): Promise<{
  birthdays: number;
  probations: number;
  contracts: number;
  expenses: number;
}> {
  const results = {
    birthdays: await checkBirthdaysAndAnniversaries(),
    probations: await checkProbationEnding(),
    contracts: await checkContractExpiry(),
    expenses: await checkPendingExpenses(),
  };

  console.log('[Notification Scheduler]', results);
  return results;
}
