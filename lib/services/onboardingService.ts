import { prisma } from '@/lib/prisma';
import { createNotificationsForRole } from './notificationService';

/**
 * Default onboarding checklist — seeded for every new hire.
 * Split into IT and HR tracks. Owner role determines which team gets notified
 * and who can check the box off in the UI.
 */
export interface DefaultOnboardingTask {
  category: 'IT' | 'HR' | 'FINANCE' | 'MANAGER';
  title: string;
  description?: string;
  ownerRole: 'ADMIN' | 'HR' | 'ACCOUNTANT' | 'EMPLOYEE';
  // Days from date of joining to complete this task
  dueOffsetDays: number;
  sortOrder: number;
}

export const DEFAULT_ONBOARDING_TASKS: DefaultOnboardingTask[] = [
  // ============ IT TRACK ============
  {
    category: 'IT',
    title: 'Create company email account',
    description: 'Provision a Google/O365 mailbox and set up forwarding rules.',
    ownerRole: 'HR',
    dueOffsetDays: 0,
    sortOrder: 10,
  },
  {
    category: 'IT',
    title: 'Issue laptop / workstation',
    description: 'Assign a machine from the asset pool and record it in Asset Management.',
    ownerRole: 'HR',
    dueOffsetDays: 0,
    sortOrder: 20,
  },
  {
    category: 'IT',
    title: 'Issue peripherals (mouse, keyboard, headset)',
    description: 'Hand out standard peripherals and tag them to the employee.',
    ownerRole: 'HR',
    dueOffsetDays: 0,
    sortOrder: 30,
  },
  {
    category: 'IT',
    title: 'Grant VPN / network access',
    description: 'Add employee to the corporate VPN and Wi-Fi access list.',
    ownerRole: 'HR',
    dueOffsetDays: 1,
    sortOrder: 40,
  },
  {
    category: 'IT',
    title: 'Create Slack / Teams account',
    description: 'Invite employee to the workspace and relevant team channels.',
    ownerRole: 'HR',
    dueOffsetDays: 1,
    sortOrder: 50,
  },
  {
    category: 'IT',
    title: 'Grant access to core SaaS tools',
    description: 'Examples: Google Workspace, Jira/Linear, GitHub, Figma, Notion.',
    ownerRole: 'HR',
    dueOffsetDays: 2,
    sortOrder: 60,
  },
  {
    category: 'IT',
    title: 'Set up two-factor authentication',
    description: 'Enforce MFA on email and critical accounts.',
    ownerRole: 'HR',
    dueOffsetDays: 2,
    sortOrder: 70,
  },

  // ============ HR TRACK ============
  {
    category: 'HR',
    title: 'Collect signed offer letter',
    description: 'Confirm the signed offer letter is on file in Employee Records.',
    ownerRole: 'ADMIN',
    dueOffsetDays: 0,
    sortOrder: 100,
  },
  {
    category: 'HR',
    title: 'Collect CNIC / passport copy',
    description: 'Upload a government-issued ID to the employee profile.',
    ownerRole: 'ADMIN',
    dueOffsetDays: 1,
    sortOrder: 110,
  },
  {
    category: 'HR',
    title: 'Collect educational & experience certificates',
    description: 'Degree, transcripts, and prior employment letters.',
    ownerRole: 'ADMIN',
    dueOffsetDays: 3,
    sortOrder: 120,
  },
  {
    category: 'HR',
    title: 'Collect bank details for payroll',
    description: 'Bank name, branch, account number for salary disbursement.',
    ownerRole: 'ADMIN',
    dueOffsetDays: 3,
    sortOrder: 130,
  },
  {
    category: 'HR',
    title: 'Sign employment contract & NDA',
    description: 'Counter-sign contract and confidentiality agreement.',
    ownerRole: 'ADMIN',
    dueOffsetDays: 1,
    sortOrder: 140,
  },
  {
    category: 'HR',
    title: 'Share employee handbook & policies',
    description: 'Code of conduct, leave policy, working hours.',
    ownerRole: 'ADMIN',
    dueOffsetDays: 1,
    sortOrder: 150,
  },
  {
    category: 'HR',
    title: 'Enroll in attendance / biometric system',
    description: 'Register fingerprint and link to attendance tracking.',
    ownerRole: 'ADMIN',
    dueOffsetDays: 2,
    sortOrder: 160,
  },
  {
    category: 'HR',
    title: 'Schedule orientation / first-day walkthrough',
    description: 'Office tour, introductions, and Day-1 orientation session.',
    ownerRole: 'ADMIN',
    dueOffsetDays: 0,
    sortOrder: 170,
  },
];

/**
 * Create the default onboarding checklist for a newly hired employee.
 * Runs as a background side-effect from the employee POST route — never throws
 * back to the caller so a seeding failure won't block employee creation.
 */
export async function seedOnboardingTasksForEmployee(
  employeeId: number,
  dateOfJoining: Date
): Promise<number> {
  try {
    const rows = DEFAULT_ONBOARDING_TASKS.map((task) => {
      const due = new Date(dateOfJoining);
      due.setDate(due.getDate() + task.dueOffsetDays);
      return {
        employeeId,
        category: task.category,
        title: task.title,
        description: task.description ?? null,
        ownerRole: task.ownerRole,
        dueDate: due,
        sortOrder: task.sortOrder,
        status: 'PENDING',
      };
    });

    // Use raw insert so we don't rely on Prisma Client regeneration in sandbox.
    // The table schema is already applied via the migration endpoint.
    let inserted = 0;
    for (const r of rows) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "onboarding_tasks"
          ("employeeId","category","title","description","ownerRole","dueDate","sortOrder","status","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
        r.employeeId,
        r.category,
        r.title,
        r.description,
        r.ownerRole,
        r.dueDate,
        r.sortOrder,
        r.status
      );
      inserted++;
    }

    // Notify IT and HR that a checklist has been assigned.
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true, empCode: true },
    });
    const name = emp ? `${emp.firstName} ${emp.lastName} (${emp.empCode})` : `Employee #${employeeId}`;

    await createNotificationsForRole('HR', {
      type: 'GENERAL',
      title: 'New Hire — Onboarding Checklist Assigned',
      message: `${name} has been added. IT setup tasks are now in your queue.`,
      link: `/employees/${employeeId}`,
    });
    await createNotificationsForRole('ADMIN', {
      type: 'GENERAL',
      title: 'New Hire — Onboarding Checklist Assigned',
      message: `${name} has been added. HR documentation tasks are now in your queue.`,
      link: `/employees/${employeeId}`,
    });

    return inserted;
  } catch (err) {
    console.error('[seedOnboardingTasksForEmployee] failed:', err);
    return 0;
  }
}

/**
 * Fetch all onboarding tasks for a single employee, sorted by category + sortOrder.
 */
export async function getOnboardingTasksForEmployee(employeeId: number) {
  // Raw select so we don't depend on Prisma Client having the model regenerated.
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, "employeeId", category, title, description, "ownerRole",
            "dueDate", status, "completedAt", "completedBy", "sortOrder",
            notes, "createdAt", "updatedAt"
       FROM "onboarding_tasks"
      WHERE "employeeId" = $1
      ORDER BY "sortOrder" ASC, id ASC`,
    employeeId
  );
  return rows;
}

/**
 * Mark a task as DONE (or update status to PENDING/SKIPPED).
 */
export async function updateOnboardingTaskStatus(
  taskId: number,
  status: 'PENDING' | 'DONE' | 'SKIPPED',
  completedBy?: number,
  notes?: string
) {
  const completedAt = status === 'DONE' ? new Date() : null;
  await prisma.$executeRawUnsafe(
    `UPDATE "onboarding_tasks"
        SET status = $1,
            "completedAt" = $2,
            "completedBy" = $3,
            notes = COALESCE($4, notes),
            "updatedAt" = NOW()
      WHERE id = $5`,
    status,
    completedAt,
    completedBy ?? null,
    notes ?? null,
    taskId
  );
}
