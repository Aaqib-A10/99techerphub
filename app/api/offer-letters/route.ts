import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const whereClause = status ? { status } : {};

    const offerLetters = await prisma.offerLetter.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(offerLetters);
  } catch (error) {
    console.error('Error fetching offer letters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offer letters' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data.candidateName?.trim()) {
      return NextResponse.json(
        { error: 'Candidate name is required' },
        { status: 400 }
      );
    }

    if (!data.position?.trim()) {
      return NextResponse.json(
        { error: 'Position is required' },
        { status: 400 }
      );
    }

    if (!data.salary) {
      return NextResponse.json(
        { error: 'Salary is required' },
        { status: 400 }
      );
    }

    if (!data.startDate) {
      return NextResponse.json(
        { error: 'Start date is required' },
        { status: 400 }
      );
    }

    const offerLetter = await prisma.offerLetter.create({
      data: {
        candidateName: data.candidateName,
        candidateEmail: data.candidateEmail || null,
        templateType: data.templateType || 'PERMANENT',
        position: data.position,
        department: data.department || null,
        companyName: data.companyName || null,
        salary: parseFloat(data.salary),
        currency: data.currency || 'PKR',
        startDate: new Date(data.startDate),
        reportingTo: data.reportingTo || null,
        contractType: data.contractType || null,
        probationPeriod: data.probationPeriod || null,
        commissionStructure: data.commissionStructure || null,
        benefits: data.benefits || null,
        workingHours: data.workingHours || null,
        terms: data.terms || null,
        customBody: data.customBody || null,
        status: 'DRAFT',
        offerDate: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'offer_letters',
        recordId: offerLetter.id,
        action: 'CREATE',
        module: 'OFFER_LETTER',
        newValues: offerLetter,
      },
    });

    return NextResponse.json(offerLetter, { status: 201 });
  } catch (error: any) {
    console.error('Error creating offer letter:', error);
    return NextResponse.json(
      { error: 'Failed to create offer letter', details: error?.message },
      { status: 500 }
    );
  }
}
