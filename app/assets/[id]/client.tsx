'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Asset, Employee, AssetCondition } from '@prisma/client';

interface AssetDetailClientProps {
  asset: Asset & { assignments: any[]; transfers: any[] };
  employees: (Employee & { department: any })[];
}

export default function AssetDetailClient({
  asset,
  employees,
}: AssetDetailClientProps) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<
    'assign' | 'return' | 'retire' | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Assign Form State
  const [assignData, setAssignData] = useState({
    employeeId: '',
    notes: '',
  });

  // Return Form State
  const [returnData, setReturnData] = useState({
    conditionAtReturn: asset.condition,
    notes: '',
  });

  // Retire Form State
  const [retireData, setRetireData] = useState({
    reason: '',
  });

  const currentAssignment = asset.assignments[0];

  const handleAssign = async () => {
    if (!assignData.employeeId) {
      setError('Please select an employee');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignData),
      });

      if (!response.ok) throw new Error('Failed to assign asset');

      router.refresh();
      setActiveModal(null);
      setAssignData({ employeeId: '', notes: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnData),
      });

      if (!response.ok) throw new Error('Failed to return asset');

      router.refresh();
      setActiveModal(null);
      setReturnData({ conditionAtReturn: asset.condition, notes: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRetire = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}/retire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retireData),
      });

      if (!response.ok) throw new Error('Failed to retire asset');

      router.refresh();
      setActiveModal(null);
      setRetireData({ reason: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        {!asset.isAssigned && !asset.isRetired && (
          <button
            onClick={() => setActiveModal('assign')}
            className="btn btn-primary w-full justify-center text-sm"
          >
            Assign Asset
          </button>
        )}

        {asset.isAssigned && !asset.isRetired && (
          <button
            onClick={() => setActiveModal('return')}
            className="btn btn-primary w-full justify-center text-sm"
          >
            Return Asset
          </button>
        )}

        {!asset.isRetired && (
          <button
            onClick={() => setActiveModal('retire')}
            className="btn btn-danger w-full justify-center text-sm"
          >
            Retire Asset
          </button>
        )}
      </div>

      {/* Assign Modal */}
      <Modal
        isOpen={activeModal === 'assign'}
        title="Assign Asset"
        onClose={() => {
          setActiveModal(null);
          setError('');
        }}
        onSubmit={handleAssign}
        submitLabel="Assign"
        submitDisabled={loading}
      >
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="form-label">Select Employee</label>
            <select
              value={assignData.employeeId}
              onChange={(e) =>
                setAssignData({ ...assignData, employeeId: e.target.value })
              }
              className="form-select"
            >
              <option value="">Choose an employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} - {emp.department.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea
              value={assignData.notes}
              onChange={(e) =>
                setAssignData({ ...assignData, notes: e.target.value })
              }
              rows={3}
              className="form-textarea"
            />
          </div>
        </div>
      </Modal>

      {/* Return Modal */}
      <Modal
        isOpen={activeModal === 'return'}
        title="Return Asset"
        onClose={() => {
          setActiveModal(null);
          setError('');
        }}
        onSubmit={handleReturn}
        submitLabel="Return"
        submitDisabled={loading}
      >
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="form-label">Asset Condition at Return</label>
            <select
              value={returnData.conditionAtReturn}
              onChange={(e) =>
                setReturnData({
                  ...returnData,
                  conditionAtReturn: e.target.value as AssetCondition,
                })
              }
              className="form-select"
            >
              <option value="NEW">New</option>
              <option value="WORKING">Working</option>
              <option value="DAMAGED">Damaged</option>
              <option value="IN_REPAIR">In Repair</option>
              <option value="LOST">Lost</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea
              value={returnData.notes}
              onChange={(e) =>
                setReturnData({ ...returnData, notes: e.target.value })
              }
              rows={3}
              className="form-textarea"
            />
          </div>
        </div>
      </Modal>

      {/* Retire Modal */}
      <Modal
        isOpen={activeModal === 'retire'}
        title="Retire Asset"
        onClose={() => {
          setActiveModal(null);
          setError('');
        }}
        onSubmit={handleRetire}
        submitLabel="Retire"
        submitDisabled={loading}
      >
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This action will mark the asset as retired and remove it from active inventory.
          </p>
          <div>
            <label className="form-label">Reason for Retirement</label>
            <textarea
              value={retireData.reason}
              onChange={(e) =>
                setRetireData({ ...retireData, reason: e.target.value })
              }
              rows={3}
              className="form-textarea"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
