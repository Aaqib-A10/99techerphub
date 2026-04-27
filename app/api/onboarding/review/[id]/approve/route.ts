import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateEmployeeId } from '@/lib/services/employeeIdService';
import { hashPassword, getSessionUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submissionId = parseInt(params.id);

    const body = await request.json().catch(() => ({}));
    const overrideCompanyId: number | undefined =
      typeof body?.companyId === 'number' ? body.companyId : undefined;
    const overrideDepartmentId: number | undefined =
      typeof body?.departmentId === 'number' ? body.departmentId : undefined;
    const overrideDesignation: string | undefined =
      typeof body?.designation === 'string' ? body.designation.trim() : undefined;

    // Fetch the onboarding submission
    const submission = await (prisma.onboardingSubmission as any).findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'Onboarding submission not found' },
        { status: 404 }
      );
    }

    if (submission.reviewStatus !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending submissions can be approved' },
        { status: 400 }
      );
    }

    // Extract personal details
    const personalDetails = submission.personalDetails || {};
    const bankDetails = submission.bankDetails || {};
    const emergencyContact = submission.emergencyContact || {};

    // Parse full name
    const fullName = personalDetails.fullName || submission.candidateName || '';
    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ') || 'N/A';

    // Resolve company: prefer admin override, then submission.companyId
    const companyId = overrideCompanyId ?? submission.companyId ?? null;
    if (!companyId) {
      return NextResponse.json(
        { error: 'Company is required — please select one in the review page' },
        { status: 400 }
      );
    }
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json(
        { error: `Company id ${companyId} not found` },
        { status: 400 }
      );
    }

    // Resolve department: prefer admin override, then submission.departmentId
    const departmentId = overrideDepartmentId ?? submission.departmentId ?? null;
    if (!departmentId) {
      return NextResponse.json(
        { error: 'Department is required — please select one in the review page' },
        { status: 400 }
      );
    }
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      return NextResponse.json(
        { error: `Department id ${departmentId} not found` },
        { status: 400 }
      );
    }

    const designation = overrideDesignation || submission.position || '';

    // Generate employee ID
    const empCode = await generateEmployeeId(department.code);

    // Create user account with temporary credentials (bcrypt hashed)
    const tempPassword = 'TempPass@' + Math.random().toString(36).substr(2, 9);
    const passwordHash = await hashPassword(tempPassword);

    // Wrap employee creation, user creation, submission update, and audit log in a transaction
    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          firstName: firstName || 'Unknown',
          lastName: lastName,
          email: submission.candidateEmail || '',
          phone: personalDetails.phone || '',
          designation: designation,
          departmentId: department.id,
          companyId: company.id,
          empCode: empCode,
          dateOfJoining: new Date(),
          cnic: personalDetails.cnic || '',
          dateOfBirth: personalDetails.dateOfBirth
            ? new Date(personalDetails.dateOfBirth)
            : undefined,
          gender: personalDetails.gender || '',
          nationality: personalDetails.nationality || '',
          maritalStatus: personalDetails.maritalStatus || '',
          bloodGroup: personalDetails.bloodGroup || '',
          passportNumber: personalDetails.passportNumber || '',
          passportExpiry: personalDetails.passportExpiry
            ? new Date(personalDetails.passportExpiry)
            : undefined,
          fatherName: personalDetails.fatherName || '',
          address: personalDetails.address || '',
          city: personalDetails.city || '',
          country: personalDetails.country || '',
          emergencyContactName: emergencyContact.name || '',
          emergencyContactPhone: emergencyContact.phone || '',
          emergencyContactRelation: emergencyContact.relationship || '',
          bankName: bankDetails.bankName || '',
          bankAccountNumber: bankDetails.accountNumber || '',
          bankBranch: bankDetails.branch || '',
          iban: bankDetails.iban || null,
          bankAccountTitle: bankDetails.accountTitle || null,
          employmentStatus: 'PROBATION',
          lifecycleStage: 'ONBOARDING',
          isActive: true,
        },
      });

      await tx.user.create({
        data: {
          email: submission.candidateEmail || emp.email,
          passwordHash: passwordHash,
          role: 'EMPLOYEE',
          employeeId: emp.id,
        },
      });

      await (tx.onboardingSubmission as any).update({
        where: { id: submissionId },
        data: {
          employeeId: emp.id,
          companyId: company.id,
          departmentId: department.id,
          companyName: company.name,
          position: designation,
          reviewStatus: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: currentUser.id,
        },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'employees',
          recordId: emp.id,
          action: 'CREATE',
          module: 'ONBOARDING',
          newValues: {
            empCode: emp.empCode,
            email: emp.email,
            firstName: emp.firstName,
            lastName: emp.lastName,
          } as any,
        },
      });

      return emp;
    });

    // Create notification (outside transaction -- non-critical)
    try {
      await prisma.notification.create({
        data: {
          userId: 1,
          type: 'EMPLOYEE_ONBOARDED',
          title: 'Onboarding Approved',
          message: `New employee ${employee.firstName} ${employee.lastName} (${empCode}) has been created`,
          link: `/employees/${employee.id}`,
        },
      });
    } catch {}

    // Welcome email to the candidate (now an employee)
    if (employee.email) {
      try {
        const { sendEmail } = await import('@/lib/services/emailService');
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://99techerp.com';
        const company = submission.companyName || '99 Technologies';
        await sendEmail({
          to: employee.email,
          subject: `Welcome to ${company}, ${employee.firstName}!`,
          templateKey: 'ONBOARDING_APPROVED',
          bodyHtml: `
            <p>Hi ${employee.firstName},</p>
            <p>Your application has been approved and you've been added to the ${company} ERP.</p>
            <p><strong>Your details:</strong></p>
            <ul>
              <li>Employee Code: <strong>${empCode}</strong></li>
              <li>Designation: ${employee.designation || '—'}</li>
              <li>Status: ${employee.employmentStatus}</li>
            </ul>
            <p>You can sign in at <a href="${appUrl}/login">${appUrl}/login</a> using your work email and the temporary password sent to you separately. Or just use Google / Microsoft SSO with your work email.</p>
            <p>Welcome aboard!</p>
            <p>— ${company} HR</p>
          `,
        });
      } catch (e) {
        console.error('[onboarding/approve] welcome email failed', e);
      }
    }

    return NextResponse.json(
      {
        success: true,
        employeeId: employee.id,
        empCode: employee.empCode,
        message: 'Employee record created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error approving onboarding submission:', error);
    return NextResponse.json(
      { error: 'Failed to approve onboarding submission' },
      { status: 500 }
    );
  }
}
