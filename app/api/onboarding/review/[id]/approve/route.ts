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

    // Get the company by name
    const company = await prisma.company.findFirst({
      where: {
        name: submission.companyName || undefined,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: `Company "${submission.companyName}" not found` },
        { status: 400 }
      );
    }

    // Default department - could be enhanced to parse from submission
    const department = await prisma.department.findFirst({
      where: { isActive: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'No default department found' },
        { status: 400 }
      );
    }

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
          designation: submission.position || '',
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
