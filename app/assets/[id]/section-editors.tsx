'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { id: number; name: string };

// -----------------------------------------------------------------------------
// AssetInfoEditor — edits the "Asset Information" card (serial, manufacturer,
// model, category, company, location).
// -----------------------------------------------------------------------------
export function AssetInfoEditor({
  assetId,
  initial,
  categories,
  companies,
  locations,
}: {
  assetId: number;
  initial: {
    serialNumber: string;
    manufacturer: string;
    model: string;
    categoryId: number;
    companyId: number;
    locationId: number;
  };
  categories: Option[];
  companies: Option[];
  locations: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initial);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed');
      setOpen(false);
      router.refresh();
    } catch {
      alert('Failed to save asset information');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-brand-primary hover:text-brand-secondary underline"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput
          label="Serial Number"
          value={form.serialNumber}
          onChange={(v) => setForm({ ...form, serialNumber: v })}
        />
        <LabeledInput
          label="Manufacturer"
          value={form.manufacturer}
          onChange={(v) => setForm({ ...form, manufacturer: v })}
        />
        <LabeledInput
          label="Model"
          value={form.model}
          onChange={(v) => setForm({ ...form, model: v })}
        />
        <LabeledSelect
          label="Category"
          value={form.categoryId}
          onChange={(v) => setForm({ ...form, categoryId: Number(v) })}
          options={categories}
        />
        <LabeledSelect
          label="Company"
          value={form.companyId}
          onChange={(v) => setForm({ ...form, companyId: Number(v) })}
          options={companies}
        />
        <LabeledSelect
          label="Location"
          value={form.locationId}
          onChange={(v) => setForm({ ...form, locationId: Number(v) })}
          options={locations}
        />
      </div>
      <EditorButtons
        saving={saving}
        onSave={save}
        onCancel={() => {
          setForm(initial);
          setOpen(false);
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// PurchaseEditor — edits the "Purchase Details" card (date, price, currency,
// warranty expiry, batch ID).
// -----------------------------------------------------------------------------
export function PurchaseEditor({
  assetId,
  initial,
}: {
  assetId: number;
  initial: {
    purchaseDate: string;
    purchasePrice: number;
    currency: string;
    warrantyExpiry: string;
    batchId: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initial);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseDate: form.purchaseDate,
          purchasePrice: form.purchasePrice,
          currency: form.currency,
          warrantyExpiry: form.warrantyExpiry || null,
          batchId: form.batchId,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setOpen(false);
      router.refresh();
    } catch {
      alert('Failed to save purchase details');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-brand-primary hover:text-brand-secondary underline"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      <div className="grid grid-cols-1 gap-3">
        <LabeledInput
          label="Purchase Date"
          type="date"
          value={form.purchaseDate}
          onChange={(v) => setForm({ ...form, purchaseDate: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput
            label="Purchase Price"
            type="number"
            value={String(form.purchasePrice)}
            onChange={(v) =>
              setForm({ ...form, purchasePrice: parseFloat(v) || 0 })
            }
          />
          <LabeledInput
            label="Currency"
            value={form.currency}
            onChange={(v) => setForm({ ...form, currency: v })}
          />
        </div>
        <LabeledInput
          label="Warranty Expiry"
          type="date"
          value={form.warrantyExpiry}
          onChange={(v) => setForm({ ...form, warrantyExpiry: v })}
        />
        <LabeledInput
          label="Batch ID"
          value={form.batchId}
          onChange={(v) => setForm({ ...form, batchId: v })}
        />
      </div>
      <EditorButtons
        saving={saving}
        onSave={save}
        onCancel={() => {
          setForm(initial);
          setOpen(false);
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// StatusEditor — edits the asset condition from the Status card.
// -----------------------------------------------------------------------------
export function StatusEditor({
  assetId,
  initialCondition,
}: {
  assetId: number;
  initialCondition: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [condition, setCondition] = useState(initialCondition);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition }),
      });
      if (!res.ok) throw new Error('Failed');
      setOpen(false);
      router.refresh();
    } catch {
      alert('Failed to update condition');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-brand-primary hover:text-brand-secondary underline"
      >
        Change condition
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <select
        value={condition}
        onChange={(e) => setCondition(e.target.value)}
        className="form-select text-sm"
      >
        <option value="NEW">New</option>
        <option value="WORKING">Working</option>
        <option value="DAMAGED">Damaged</option>
        <option value="IN_REPAIR">In Repair</option>
        <option value="LOST">Lost</option>
        <option value="RETIRED">Retired</option>
      </select>
      <EditorButtons
        saving={saving}
        onSave={save}
        onCancel={() => {
          setCondition(initialCondition);
          setOpen(false);
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Shared small helpers
// -----------------------------------------------------------------------------

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-semibold text-gray-600 uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="form-input mt-1 w-full text-sm"
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-semibold text-gray-600 uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-select mt-1 w-full text-sm"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditorButtons({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="btn btn-primary text-sm px-4 py-1"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={onCancel}
        className="btn btn-secondary text-sm px-4 py-1"
      >
        Cancel
      </button>
    </div>
  );
}
