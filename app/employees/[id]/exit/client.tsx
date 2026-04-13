'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AssetCondition } from '@prisma/client';

interface ExitClientProps {
  employee: any;
  exitRecord: any;
  activeAssignments: any[];
  digitalAccessRecords: any[];
}

export default function EmployeeExitClient({
  employee,
  exitRecord,
  activeAssignments,
  digitalAccessRecords,
}: ExitClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'details' | 'assets' | 'digital' | 'finance'
  >('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Exit Details state
  const [exitDate, setExitDate] = useState(
    exitRecord?.exitDate
      ? new Date(exitRecord.exitDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [exitType, setExitType] = useState(exitRecord?.exitType || 'RESIGNATION');
  const [reason, setReason] = useState(exitRecord?.reason || '');
  const [notes, setNotes] = useState('');

  // Asset clearance state
  const [assetReturns, setAssetReturns] = useState<
    Record<
      number,
      {
        returned: boolean;
        condition: AssetCondition;
        notes: string;
      }
    >
  >(
    activeAssignments.reduce(
      (acc, assignment) => {
        acc[assignment.id] = {
          returned: false,
          condition: 'WORKING',
          notes: '',
        };
        return acc;
      },
      {} as Record<
        number,
        {
          returned: boolean;
          condition: AssetCondition;
          notes: string;
        }
      >
    )
  );

  // Digital access state
  const [revokedAccess, setRevokedAccess] = useState<Record<number, boolean>>(
    digitalAccessRecords.reduce(
      (acc, record) => {
        acc[record.id] = false;
        return acc;
      },
      {} as Record<number, boolean>
    )
  );

  // Finance state
  const [finalSettlement, setFinalSettlement] = useState(
    exitRecord?.finalSettlement || 0
  );
  const [outstandingDues, setOutstandingDues] = useState(0);
  const [bonusCommission, setBonusCommission] = useState(0);

  const handleInitiateExit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(
        `/api/employees/${employee.id}/exit/initiate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exitDate: new Date(exitDate).toISOString(),
            reason,
            exitType,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate exit');
      }

      setSuccess('Exit initiated successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnAsset = async (assignmentId: number) => {
    setLoading(true);
    setError('');
    try {
      const assignment = activeAssignments.find((a) => a.id === assignmentId);
      const response = await fetch(
        `/api/assets/${assignment.assetId}/return`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conditionAtReturn: assetReturns[assignmentId].condition,
            notes: assetReturns[assignmentId].notes,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to return asset');
      }

      setSuccess('Asset returned successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAllAccess = async () => {
    setLoading(true);
    setError('');
    try {
      for (const record of digitalAccessRecords) {
        if (!revokedAccess[record.id]) {
          const response = await fetch(
            `/api/digital-access/${record.id}/revoke`,
            {
              method: 'POST',
            }
          );

          if (!response.ok) {
            throw new Error('Failed to revoke access');
          }

          setRevokedAccess((prev) => ({ ...prev, [record.id]: true }));
        }
      }

      setSuccess('All digital access revoked successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteExit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    const allAssetsReturned = Object.values(assetReturns).every(
      (a) => a.returned
    );
    const allAccessRevoked = Object.values(revokedAccess).every((r) => r);

    if (activeAssignments.length > 0 && !allAssetsReturned) {
      setError('Please mark all assets as returned');
      setLoading(false);
      return;
    }

    if (digitalAccessRecords.length > 0 && !allAccessRevoked) {
      setError('Please revoke all digital access');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/employees/${employee.id}/exit/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            finalSettlement,
            notes,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete exit');
      }

      setSuccess('Exit completed successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const allAssetsReturned = Object.values(assetReturns).every((a) => a.returned);
  const allAccessRevoked = Object.values(revokedAccess).every((r) => r);
  const canCompleteExit =
    (activeAssignments.length === 0 || allAssetsReturned) &&
    (digitalAccessRecords.length === 0 || allAccessRevoked);

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { id: 'details', label: 'Exit Details' },
          { id: 'assets', label: 'Asset Clearance' },
          { id: 'digital', label: 'Digital Access' },
          { id: 'finance', label: 'Finance Settlement' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Exit Details Tab */}
      {activeTab === 'details' && (
        <div className="card">
          <div className="card-body space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exit Date
                </label>
                <input
                  type="date"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exit Type
                </label>
                <select
                  value={exitType}
                  onChange={(e) => setExitType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                >
                  <option value="RESIGNATION">Resignation</option>
                  <option value="TERMINATION">Termination</option>
                  <option value="CONTRACT_END">Contract End</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Exit
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for exit..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exit Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleInitiateExit}
                disabled={loading}
                className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
              >
                {loading ? 'Initiating...' : 'Initiate Exit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Clearance Tab */}
      {activeTab === 'assets' && (
        <div className="card">
          <div className="card-body">
            {activeAssignments.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                No active asset assignments
              </p>
            ) : (
              <div className="space-y-4">
                {activeAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {assignment.asset.assetTag}
                        </p>
                        <p className="text-sm text-gray-600">
                          {assignment.asset.category.name} • {assignment.asset.manufacturer}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Serial: {assignment.asset.serialNumber}
                        </p>
                      </div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={assetReturns[assignment.id]?.returned || false}
                          onChange={(e) =>
                            setAssetReturns((prev) => ({
                              ...prev,
                              [assignment.id]: {
                                ...prev[assignment.id],
                                returned: e.target.checked,
                              },
                            }))
                          }
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm font-medium">Returned</span>
                      </label>
                    </div>

                    {assetReturns[assignment.id]?.returned && (
                      <div className="space-y-3 bg-gray-50 p-3 rounded mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Condition at Return
                          </label>
                          <select
                            value={
                              assetReturns[assignment.id]?.condition || 'WORKING'
                            }
                            onChange={(e) =>
                              setAssetReturns((prev) => ({
                                ...prev,
                                [assignment.id]: {
                                  ...prev[assignment.id],
                                  condition: e.target.value as AssetCondition,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="WORKING">Working</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="LOST">Lost</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Return Notes
                          </label>
                          <input
                            type="text"
                            value={assetReturns[assignment.id]?.notes || ''}
                            onChange={(e) =>
                              setAssetReturns((prev) => ({
                                ...prev,
                                [assignment.id]: {
                                  ...prev[assignment.id],
                                  notes: e.target.value,
                                },
                              }))
                            }
                            placeholder="Add any notes..."
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleReturnAsset(assignment.id)}
                          disabled={loading}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {loading ? 'Processing...' : 'Process Return'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {allAssetsReturned && (
                  <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
                    All assets returned
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Digital Access Tab */}
      {activeTab === 'digital' && (
        <div className="card">
          <div className="card-body">
            {digitalAccessRecords.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                No active digital access records
              </p>
            ) : (
              <div className="space-y-4">
                {digitalAccessRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {record.serviceName}
                      </p>
                      {record.accountId && (
                        <p className="text-sm text-gray-600">{record.accountId}</p>
                      )}
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={revokedAccess[record.id] || false}
                        onChange={(e) =>
                          setRevokedAccess((prev) => ({
                            ...prev,
                            [record.id]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm font-medium">Revoked</span>
                    </label>
                  </div>
                ))}

                <div className="flex gap-3 mt-6 pt-4 border-t">
                  <button
                    onClick={handleRevokeAllAccess}
                    disabled={loading || allAccessRevoked}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? 'Revoking...' : 'Revoke All'}
                  </button>
                </div>

                {allAccessRevoked && (
                  <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
                    All digital access revoked
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finance Settlement Tab */}
      {activeTab === 'finance' && (
        <div className="card">
          <div className="card-body space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Outstanding Dues
                </label>
                <input
                  type="number"
                  value={outstandingDues}
                  onChange={(e) => setOutstandingDues(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bonus/Commission Owed
                </label>
                <input
                  type="number"
                  value={bonusCommission}
                  onChange={(e) => setBonusCommission(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Final Settlement
                </label>
                <input
                  type="number"
                  value={finalSettlement}
                  onChange={(e) => setFinalSettlement(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">Settlement Summary:</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Outstanding Dues:</span>
                  <span className="font-semibold">{outstandingDues}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bonus/Commission:</span>
                  <span className="font-semibold">{bonusCommission}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-base font-bold">
                  <span>Total Settlement:</span>
                  <span className="text-brand-primary">
                    {outstandingDues + bonusCommission}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCompleteExit}
                disabled={loading || !canCompleteExit}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                  canCompleteExit
                    ? 'bg-brand-primary text-white hover:bg-brand-dark'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? 'Completing...' : 'Complete Exit'}
              </button>
            </div>

            {!canCompleteExit && (
              <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded text-sm">
                Please complete all sections before finalizing exit.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
