import ScanClient from './client';

export const dynamic = 'force-dynamic';

export default function AssetScanPage({
  searchParams,
}: {
  searchParams: { tag?: string };
}) {
  // If the user arrived via a QR URL like /assets/scan?tag=LAPTOP-0001,
  // ScanClient will auto-resolve it and redirect to the detail page.
  return <ScanClient initialTag={searchParams.tag || ''} />;
}
