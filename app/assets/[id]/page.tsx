import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import AssetDetailClient from './client';
import AssetSpecsEditor from './specs-editor';
import NotesEditor from './notes-editor';
import { AssetInfoEditor, PurchaseEditor, StatusEditor } from './section-editors';

function calculateWarrantyStatus(warrantyExpiry: Date | null) {
  if (!warrantyExpiry) return { daysRemaining: null, status: 'unknown', badgeColor: 'gray' };

  const now = new Date();
  const expiryTime = warrantyExpiry.getTime();
  const nowTime = now.getTime();
  const daysRemaining = Math.ceil((expiryTime - nowTime) / (1000 * 60 * 60 * 24));

  let status = 'expired';
  let badgeColor = 'red';

  if (daysRemaining > 90) {
    status = 'valid';
    badgeColor = 'green';
  } else if (daysRemaining > 30) {
    status = 'warning';
    badgeColor = 'yellow';
  } else if (daysRemaining > 0) {
    status = 'critical';
    badgeColor = 'red';
  }

  return { daysRemaining, status, badgeColor };
}

function calculateDepreciation(purchasePrice: number, purchaseDate: Date | null, assetCategory: string) {
  // Straight-line depreciation over 3 years for laptops
  const depreciationYears = assetCategory.toUpperCase() === 'LAPTOP' ? 3 : null;

  if (!depreciationYears || !purchaseDate || !purchasePrice) return null;

  const monthsOwned = Math.floor(
    (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  const totalMonths = depreciationYears * 12;
  const monthlyDepreciation = purchasePrice / totalMonths;
  const totalDepreciation = monthlyDepreciation * monthsOwned;
  const currentValue = Math.max(0, purchasePrice - totalDepreciation);

  return {
    originalPrice: purchasePrice,
    currentValue,
    depreciation: totalDepreciation,
    percentDepreciated: (totalDepreciation / purchasePrice) * 100,
  };
}

export default async function AssetDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const assetId = parseInt(params.id);

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      category: true,
      company: true,
      location: true,
      assignments: {
        include: {
          employee: { include: { department: true } },
          assignedBy: true,
        },
        orderBy: { assignedDate: 'desc' },
      },
      transfers: {
        include: {
          fromCompany: true,
          toCompany: true,
          transferredByEmployee: true,
        },
        orderBy: { transferDate: 'desc' },
      },
    },
  });

  if (!asset) {
    notFound();
  }

  const [employees, allCategories, allCompanies, allLocations] = await Promise.all([
    prisma.employee.findMany({ include: { department: true } }),
    prisma.assetCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
  ]);
  const currentAssignment = asset.assignments[0];

  const warrantyStatus = calculateWarrantyStatus(asset.warrantyExpiry);
  const depreciation = calculateDepreciation(asset.purchasePrice, asset.purchaseDate, asset.category.code);

  return (
    <div className="space-y-6">
      {/* Hero header card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              {asset.category.name}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">{asset.assetTag}</h1>
            <p className="mt-1.5 text-sm text-gray-600">
              <span className="font-medium text-gray-700">{asset.manufacturer}</span>
              {asset.model && asset.model !== 'Unknown' && <> · {asset.model}</>}
              {asset.company?.name && <>{' · '}<span>{asset.company.name}</span></>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge condition={asset.condition} />
            <Link
              href={`/assets/${asset.id}/label`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-brand-primary hover:text-brand-primary hover:shadow"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Label
            </Link>
          </div>
        </div>
      </div>

      {/* Main Layout: 2-column (2/3 left, 1/3 right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo Display */}
          {asset.photoUrl && (
            <div className="card">
              <div className="card-body">
                <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <img
                    src={asset.photoUrl}
                    alt={asset.assetTag}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Asset Information Card */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h2 className="section-heading">Asset Information</h2>
              <AssetInfoEditor
                assetId={asset.id}
                initial={{
                  serialNumber: asset.serialNumber,
                  manufacturer: asset.manufacturer,
                  model: asset.model,
                  categoryId: asset.categoryId,
                  companyId: asset.companyId,
                  locationId: asset.locationId,
                }}
                categories={allCategories.map((c) => ({ id: c.id, name: c.name }))}
                companies={allCompanies.map((c) => ({ id: c.id, name: c.name }))}
                locations={allLocations.map((l) => ({ id: l.id, name: l.name }))}
              />
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Serial Number</p>
                  <p className="font-mono font-semibold">{asset.serialNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Manufacturer</p>
                  <p className="font-semibold">{asset.manufacturer}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Model</p>
                  <p className="font-semibold">{asset.model}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="font-semibold">{asset.category.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Company</p>
                  <p className="font-semibold">{asset.company?.name || <span className="text-gray-400">—</span>}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-semibold">{asset.location?.name || <span className="text-gray-400">—</span>}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Added to Inventory</p>
                  <p className="font-semibold">
                    {asset.createdAt.toLocaleDateString()}
                  </p>
                </div>
                {asset.retiredDate && (
                  <div>
                    <p className="text-sm text-gray-600">Retired Date</p>
                    <p className="font-semibold">
                      {asset.retiredDate.toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Specifications Card */}
          <div className="card">
            <div className="card-header">
              <p className="text-lg font-semibold text-gray-900">Specifications</p>
            </div>
            <div className="card-body">
              {asset.specs && typeof asset.specs === 'object' && Object.keys(asset.specs as Record<string, string>).length > 0 ? (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {Object.entries(asset.specs as Record<string, string>).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 uppercase">{key}</p>
                      <p className="text-sm font-medium text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm mb-4">No specs added yet</p>
              )}
              <AssetSpecsEditor assetId={asset.id} currentSpecs={(asset.specs as Record<string, string>) || {}} categoryCode={asset.category.code} />
            </div>
          </div>

          {/* Assignment History */}
          <div className="card">
            <div className="card-header">
              <h2 className="section-heading">Assignment History</h2>
            </div>
            <div className="card-body">
              {asset.assignments.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No assignments yet</p>
              ) : (
                <div className="space-y-4">
                  {asset.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="border-l-4 border-brand-primary pl-4 py-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {assignment.employee.firstName}{' '}
                            {assignment.employee.lastName}
                          </p>
                          <p className="text-sm text-gray-600">
                            {assignment.employee.department.name} •{' '}
                            {assignment.employee.designation}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Assigned</p>
                          <p className="font-mono text-sm">
                            {assignment.assignedDate.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {assignment.returnedDate && (
                        <div className="text-right mt-2">
                          <p className="text-sm text-gray-600">Returned</p>
                          <p className="font-mono text-sm">
                            {assignment.returnedDate.toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {assignment.notes && (
                        <p className="text-sm text-gray-600 mt-2">
                          Note: {assignment.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Transfer History */}
          {asset.transfers.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="section-heading">Transfer History</h2>
              </div>
              <div className="card-body">
                <div className="space-y-4">
                  {asset.transfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="border-l-4 border-blue-500 pl-4 py-2"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {transfer.fromCompany.name}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {transfer.toCompany.name}
                          </p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-sm text-gray-600">
                            {transfer.transferDate.toLocaleDateString()}
                          </p>
                          {transfer.reason && (
                            <p className="text-sm text-gray-500">{transfer.reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (1/3) */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="section-heading">Status</h2>
            </div>
            <div className="card-body space-y-4">
              <div>
                <p className="text-sm text-gray-600">Condition</p>
                <div className="mt-2">
                  <StatusBadge condition={asset.condition} />
                </div>
                <div className="mt-1">
                  <StatusEditor assetId={asset.id} initialCondition={asset.condition} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Assignment</p>
                <p className="font-semibold mt-2">
                  {asset.isAssigned ? '✓ Assigned' : '○ Unassigned'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-semibold mt-2">
                  {asset.isRetired ? '✓ Retired' : '○ Active'}
                </p>
              </div>
            </div>
            <div className="card-footer">
              <AssetDetailClient asset={asset} employees={employees} />
            </div>
          </div>

          {/* Warranty Status Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="section-heading">Warranty</h2>
            </div>
            <div className="card-body">
              {asset.warrantyExpiry ? (
                <>
                  <div className="mb-3">
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      warrantyStatus.badgeColor === 'green' ? 'bg-green-100 text-green-800' :
                      warrantyStatus.badgeColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {warrantyStatus.daysRemaining !== null && warrantyStatus.daysRemaining > 0
                        ? `${warrantyStatus.daysRemaining} days left`
                        : 'Expired'
                      }
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Expires on</p>
                  <p className="font-semibold text-gray-900">
                    {asset.warrantyExpiry.toLocaleDateString()}
                  </p>
                </>
              ) : (
                <p className="text-gray-500 text-sm">No warranty information</p>
              )}
            </div>
          </div>

          {/* Purchase & Financial Details */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h2 className="section-heading">Purchase Details</h2>
              <PurchaseEditor
                assetId={asset.id}
                initial={{
                  purchaseDate: asset.purchaseDate
                    ? asset.purchaseDate.toISOString().slice(0, 10)
                    : '',
                  purchasePrice: asset.purchasePrice,
                  currency: asset.currency,
                  warrantyExpiry: asset.warrantyExpiry
                    ? asset.warrantyExpiry.toISOString().slice(0, 10)
                    : '',
                  batchId: asset.batchId || '',
                }}
              />
            </div>
            <div className="card-body space-y-4">
              <div>
                <p className="text-sm text-gray-600">Purchase Date</p>
                <p className="font-semibold text-gray-900">
                  {asset.purchaseDate
                    ? asset.purchaseDate.toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Purchase Price</p>
                <p className="font-semibold text-gray-900">
                  {asset.purchasePrice.toLocaleString()} {asset.currency}
                </p>
              </div>
              {asset.batchId && (
                <div>
                  <p className="text-sm text-gray-600">Batch ID</p>
                  <p className="font-mono font-semibold text-gray-900">{asset.batchId}</p>
                </div>
              )}
              {depreciation && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Depreciation (3-year)</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Value:</span>
                      <span className="font-semibold">{depreciation.currentValue.toLocaleString()} {asset.currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Depreciation:</span>
                      <span className="font-semibold">{depreciation.depreciation.toLocaleString()} {asset.currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Depreciated:</span>
                      <span className="font-semibold">{depreciation.percentDepreciated.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="section-heading">Notes</h2>
            </div>
            <div className="card-body">
              <NotesEditor assetId={asset.id} currentNotes={asset.notes || ''} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
