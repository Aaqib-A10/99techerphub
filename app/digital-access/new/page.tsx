'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  empCode: string;
  email: string;
}

const SERVICES = ['O365', 'Claude', 'GitHub Copilot', 'VPN', 'Biometric', 'Slack', 'Zoom', 'Other'];

export default function NewDigitalAccessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [formData, setFormData] = useState({ employeeId: '', serviceName: '', accountId: '', notes: '' });

  useEffect(() => {
    fetch('/api/employees?isActive=true')
      .then(r => r.json())
      .then(d => setEmployees(d))
      .catch(() => { })
      .finally(() => setEmployeesLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.employeeId || !formData.serviceName) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/digital-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: parseInt(formData.employeeId),
          serviceName: formData.serviceName,
          accountId: formData.accountId || null,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to grant access');
      }

      router.push('/digital-access');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="breadcrumb mb-6">
        <Link href="/digital-access" className="breadcrumb-item">Digital Access</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item active">Grant New Access</span>
      </div>
      <PageHero
        eyebrow="Assets / Digital"
        title="Grant Digital Access"
        description="Assign a digital service or tool to an employee"
      />
      <div className="card max-w-2xl">
        <div className="card-body">
          {error && <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Employee *</label>
              {employeesLoading ? <p className="text-gray-500">Loading employees...</p> : (
                <select value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent">
                  <option value="">Select an employee...</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.empCode})</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service *</label>
              <select value={formData.serviceName} onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent">
                <option value="">Select a service...</option>
                {SERVICES.map((service) => <option key={service} value={service}>{service}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account ID / Email / Username</label>
              <input type="text" value={formData.accountId} onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} placeholder="e.g., john.doe@example.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional information..." rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button type="submit" disabled={loading} className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
                {loading ? 'Granting Access...' : 'Grant Access'}
              </button>
              <Link href="/digital-access" className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}