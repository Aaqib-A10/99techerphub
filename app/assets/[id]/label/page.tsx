import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import LabelClient from './client';

export default async function AssetLabelPage({
  params,
}: {
  params: { id: string };
}) {
  const asset = await prisma.asset.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      category: true,
      company: true,
      location: true,
    },
  });

  if (!asset) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Asset not found</p>
        <Link href="/assets" className="btn btn-primary">
          Back to Assets
        </Link>
      </div>
    );
  }

  return (
    <LabelClient
      asset={{
        id: asset.id,
        assetTag: asset.assetTag,
        serialNumber: asset.serialNumber,
        manufacturer: asset.manufacturer,
        model: asset.model,
        categoryName: asset.category?.name ?? '—',
        companyName: asset.company?.name ?? '—',
        locationName: asset.location?.name ?? '—',
      }}
    />
  );
}
