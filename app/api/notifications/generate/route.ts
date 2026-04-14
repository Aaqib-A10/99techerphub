import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

interface GenerationSummary {
  birthdays: number;
  anniversaries: number;
  probationEnding: number;
  warrantyExpiring: number;
  unassignedAssets: number;
  duplicatesSkipped: number;
  total: number;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary: GenerationSummary = {
      birthdays: 0,
      anniversaries: 0,
      probationEnding: 0,
      warrantyExpiring: 0,
      unassignedAssets: 0,
      duplicatesSkipped: 0,
      total: 0,
    };

    // Get admin user (first user or hardcoded admin)
    const adminUser = await prisma.user.findFirst({
      orderBy: { id: 'asc' },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: 'No admin user found', summary },
        { status: 404 }
      );
    }

    const userId = adminUser.id;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Helper function to check for duplicate notifications
    const checkDuplicate = async (
      type: string,
      title: string,
      message: string
    ): Promise<boolean> => {
      const lastDay = new Date(now);
      lastDay.setDate(lastDay.getDate() - 1);

      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type: type as any,
          title,
          message,
          createdAt: {
            gte: lastDay,
          },
        },
      });

      return !!existing;
    };

    // 1. UPCOMING BIRTHDAYS (next 7 days)
    const employeesWithBirthdays = await prisma.employee.findMany({
      where: {
        dateOfBirth: { not: null } as any,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
      },
    });

    for (const emp of employeesWithBirthdays) {
      if (!emp.dateOfBirth) continue;

      const birthMonth = emp.dateOfBirth.getMonth();
      const birthDay = emp.dateOfBirth.getDate();

      const birthdayThisYear = new Date(today.getFullYear(), birthMonth, birthDay);

      // Check if birthday already passed this year
      if (birthdayThisYear < today) {
        birthdayThisYear.setFullYear(birthdayThisYear.getFullYear() + 1);
      }

      // Check if birthday is within 7 days
      if (
        birthdayThisYear >= today &&
        birthdayThisYear <= sevenDaysFromNow
      ) {
        const title = `${emp.firstName} ${emp.lastName}'s Birthday on ${birthdayThisYear.toLocaleDateString()}`;
        const message = `${emp.firstName} ${emp.lastName} has a birthday coming up on ${birthdayThisYear.toLocaleDateString()}`;
        const link = `/dashboard/employees/${emp.id}`;

        const isDuplicate = await checkDuplicate('GENERAL', title, message);
        if (!isDuplicate) {
          await prisma.notification.create({
            data: {
              userId,
              type: 'GENERAL',
              title,
              message,
              link,
            },
          });
          summary.birthdays++;
          summary.total++;
        } else {
          summary.duplicatesSkipped++;
        }
      }
    }

    // 2. WORK ANNIVERSARIES (next 7 days)
    const employeesWithJoiningDates = await prisma.employee.findMany({
      where: {
        dateOfJoining: { not: null } as any,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfJoining: true,
      },
    });

    for (const emp of employeesWithJoiningDates) {
      if (!emp.dateOfJoining) continue;

      const joiningMonth = emp.dateOfJoining.getMonth();
      const joiningDay = emp.dateOfJoining.getDate();
      const joiningYear = emp.dateOfJoining.getFullYear();

      // Check if employee has been there more than 1 year
      const yearsOfService = today.getFullYear() - joiningYear;
      if (yearsOfService < 1) continue;

      // Calculate next anniversary
      let anniversaryThisYear = new Date(today.getFullYear(), joiningMonth, joiningDay);
      if (anniversaryThisYear < today) {
        anniversaryThisYear = new Date(today.getFullYear() + 1, joiningMonth, joiningDay);
      }

      // Check if anniversary is within 7 days
      if (
        anniversaryThisYear >= today &&
        anniversaryThisYear <= sevenDaysFromNow
      ) {
        const yearsCompleted = anniversaryThisYear.getFullYear() - joiningYear;
        const title = `${emp.firstName} ${emp.lastName}'s ${yearsCompleted}-Year Anniversary on ${anniversaryThisYear.toLocaleDateString()}`;
        const message = `${emp.firstName} ${emp.lastName} is completing ${yearsCompleted} years of service on ${anniversaryThisYear.toLocaleDateString()}`;
        const link = `/dashboard/employees/${emp.id}`;

        const isDuplicate = await checkDuplicate('GENERAL', title, message);
        if (!isDuplicate) {
          await prisma.notification.create({
            data: {
              userId,
              type: 'GENERAL',
              title,
              message,
              link,
            },
          });
          summary.anniversaries++;
          summary.total++;
        } else {
          summary.duplicatesSkipped++;
        }
      }
    }

    // 3. PROBATION ENDING (next 30 days)
    const employeesOnProbation = await prisma.employee.findMany({
      where: {
        employmentStatus: 'PROBATION',
        probationEndDate: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        probationEndDate: true,
      },
    });

    for (const emp of employeesOnProbation) {
      const title = `Probation Ending: ${emp.firstName} ${emp.lastName}`;
      const message = `${emp.firstName} ${emp.lastName}'s probation period ends on ${emp.probationEndDate?.toLocaleDateString()}`;
      const link = `/dashboard/employees/${emp.id}`;

      const isDuplicate = await checkDuplicate('SYSTEM_ALERT', title, message);
      if (!isDuplicate) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM_ALERT',
            title,
            message,
            link,
          },
        });
        summary.probationEnding++;
        summary.total++;
      } else {
        summary.duplicatesSkipped++;
      }
    }

    // 4. WARRANTY EXPIRING (next 30 days)
    const assetsWithExpiringWarranty = await prisma.asset.findMany({
      where: {
        warrantyExpiry: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
        isRetired: false,
      },
      select: {
        id: true,
        assetTag: true,
        model: true,
        warrantyExpiry: true,
      },
    });

    for (const asset of assetsWithExpiringWarranty) {
      const title = `Warranty Expiring: ${asset.assetTag}`;
      const message = `Asset ${asset.assetTag} (${asset.model}) warranty expires on ${asset.warrantyExpiry?.toLocaleDateString()}`;
      const link = `/dashboard/assets/${asset.id}`;

      const isDuplicate = await checkDuplicate('SYSTEM_ALERT', title, message);
      if (!isDuplicate) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM_ALERT',
            title,
            message,
            link,
          },
        });
        summary.warrantyExpiring++;
        summary.total++;
      } else {
        summary.duplicatesSkipped++;
      }
    }

    // 5. UNASSIGNED ASSETS >90 DAYS
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const unassignedAssets = await prisma.asset.findMany({
      where: {
        isAssigned: false,
        isRetired: false,
        createdAt: {
          lte: ninetyDaysAgo,
        },
      },
      select: {
        id: true,
        assetTag: true,
        model: true,
        createdAt: true,
      },
    });

    for (const asset of unassignedAssets) {
      const title = `Unassigned Asset: ${asset.assetTag}`;
      const message = `Asset ${asset.assetTag} (${asset.model}) has been unassigned for over 90 days since ${asset.createdAt.toLocaleDateString()}`;
      const link = `/dashboard/assets/${asset.id}`;

      const isDuplicate = await checkDuplicate('SYSTEM_ALERT', title, message);
      if (!isDuplicate) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM_ALERT',
            title,
            message,
            link,
          },
        });
        summary.unassignedAssets++;
        summary.total++;
      } else {
        summary.duplicatesSkipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Notifications generated successfully',
      summary,
    });
  } catch (error) {
    console.error('Error generating notifications:', error);
    return NextResponse.json(
      { error: 'Failed to generate notifications', details: String(error) },
      { status: 500 }
    );
  }
}
