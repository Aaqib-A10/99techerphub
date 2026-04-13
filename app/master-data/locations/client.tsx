'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

interface Location {
  id: number;
  name: string;
  address: string | null;
  country: string;
}

interface LocationsClientProps {
  initialLocations: Location[];
  employeeCounts: Record<number, number>;
  assetCounts: Record<number, number>;
}

export default function LocationsClient({
  initialLocations,
  employeeCounts,
  assetCounts,
}: LocationsClientProps) {
  const [locations, setLocations] = useState(initialLocations);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    country: '',
  });

  const handleAdd = async () => {
    if (!formData.name || !formData.country) {
      setError('Location name and country are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to create location');
      }

      const newLocation = await res.json();
      setLocations([newLocation, ...locations]);
      setFormData({ name: '', address: '', country: '' });
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Location
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        title="Add New Location"
        onClose={() => {
          setIsModalOpen(false);
          setFormData({ name: '', address: '', country: '' });
          setError('');
        }}
        onSubmit={handleAdd}
        submitLabel="Create Location"
        submitDisabled={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Location Name *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Eagan Office"
            />
          </div>
          <div>
            <label className="form-label">Address</label>
            <textarea
              className="form-input"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Street address, floor details"
              rows={3}
            />
          </div>
          <div>
            <label className="form-label">Country *</label>
            <select
              className="form-input"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            >
              <option value="">Select Country</option>
              <option value="US">United States</option>
              <option value="AE">United Arab Emirates</option>
              <option value="PK">Pakistan</option>
            </select>
          </div>
        </div>
      </Modal>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Country</th>
                <th>Employees</th>
                <th>Assets</th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500">
                    No locations found
                  </td>
                </tr>
              ) : (
                locations.map((location) => (
                  <tr key={location.id}>
                    <td className="font-semibold">{location.name}</td>
                    <td className="text-sm text-gray-600">{location.address || '-'}</td>
                    <td>{location.country}</td>
                    <td className="text-center">{employeeCounts[location.id] || 0}</td>
                    <td className="text-center">{assetCounts[location.id] || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
