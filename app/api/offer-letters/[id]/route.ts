import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);

    const offerLetter = await prisma.offerLetter.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!offerLetter) {
      return NextResponse.json(
        { error: 'Offer letter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(offerLetter);
  } catch (error) {
    console.error('Error fetching offer letter:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offer letter' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    const data = await request.json();

    const offerLetter = await prisma.offerLetter.findUnique({
      where: { id },
    });

    if (!offerLetter) {
      return NextResponse.json(
        { error: 'Offer letter not found' },
        { status: 404 }
      );
    }

    const updateData: any = {
      status: data.status,
    };

    if (data.status === 'SENT' && !offerLetter.sentAt) {
      updateData.sentAt = new Date();
    }

    if (data.status === 'ACCEPTED' && !offerLetter.acceptedDate) {
      updateData.acceptedDate = new Date();
    }

    const updatedOfferLetter = await prisma.offerLetter.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'offer_letters',
        recordId: id,
        action: 'UPDATE',
        module: 'OFFER_LETTER',
        oldValues: offerLetter,
        newValues: updatedOfferLetter,
      },
    });

    return NextResponse.json(updatedOfferLetter);
  } catch (error: any) {
    console.error('Error updating offer letter:', error);
    return NextResponse.json(
      { error: 'Failed to update offer letter' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);

    const offerLetter = await prisma.offerLetter.findUnique({
      where: { id },
    });

    if (!offerLetter) {
      return NextResponse.json(
        { error: 'Offer letter not found' },
        { status: 404 }
      );
    }

    if (offerLetter.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft offer letters can be deleted' },
        { status: 400 }
      );
    }

    await prisma.offerLetter.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'offer_letters',
        recordId: id,
        action: 'DELETE',
        module: 'OFFER_LETTER',
        oldValues: offerLetter,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting offer letter:', error);
    return NextResponse.json(
      { error: 'Failed to delete offer letter' },
      { status: 500 }
    );
  }
}
