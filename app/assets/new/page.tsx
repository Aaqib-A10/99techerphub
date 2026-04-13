'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageHero from '@/app/components/PageHero';

// Categories that REQUIRE a serial number (high-value trackable items)
const SERIAL_REQUIRED_CODES = ['LAPTOP', 'PC', 'MON', 'MOB', 'TAB'];

// Manufacturer options per category type
const MANUFACTURER_OPTIONS: Record<string, string[]> = {
  LAPTOP: ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Other'],
  PC: ['Dell', 'HP', 'Lenovo', 'Acer', 'Other'],
  MON: ['Dell', 'HP', 'LG', 'Samsung', 'Acer', 'BenQ', 'Other'],
  MOB: ['Apple', 'Samsung', 'Google', 'OnePlus', 'Other'],
  TAB: ['Apple', 'Samsung', 'Lenovo', 'Other'],
  HEAD: ['Sony', 'Jabra', 'Plantronics', 'Logitech', 'Other'],
  ACC: ['Logitech', 'Microsoft', 'Razer', 'Other'],
  NET: ['Cisco', 'Netgear', 'TP-Link', 'Ubiquiti', 'Other'],
  FURN: ['Herman Miller', 'Steelcase', 'IKEA', 'Other'],
  SW: ['Microsoft', 'Adobe', 'JetBrains', 'Other'],
};

export default function NewAssetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    serialNumber: '',
    categoryId: '',
    manufacturer: '',
    model: '',
    condition: 'WORKING',
    notes: '',
    purchasePrice: '',
    currency: 'PKR',
    warrantyExpiry: '',
    batchId: '',
    photoUrl: '',
  });

  const [categories, setCategories] = useState<any[]>([]);

  // Load categories on mount
  useState(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((cats) => setCategories(cats))
      .catch((err) => console.error('Failed to load categories:', err));
  })[0];

  // Get the selected category object
  const selectedCategory = useMemo(() => {
    if (!formData.categoryId) return null;
    return categories.find((c) => c.id === parseInt(formData.categoryId));
  }, [formData.categoryId, categories]);

  // Is serial number required for this category?
  const serialRequired = useMemo(() => {
    if (!selectedCategory) return true; // default to required
    return SERIAL_REQUIRED_CODES.includes(selectedCategory.code);
  }, [selectedCategory]);

  // Get manufacturer options for this category
  const manufacturers = useMemo(() => {
    if (!selectedCategory) return ['Other'];
    return MANUFACTURER_OPTIONS[selectedCategory.code] || ['Other'];
  }, [selectedCategory]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Reset manufacturer when category changes
      if (name === 'categoryId') {
        updated.manufacturer = '';
      }
      return updated;
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.categoryId) {
        throw new Error('Category is required');
      }
      if (serialRequired && !formData.serialNumber.trim()) {
        throw new Error('Serial number is required for this category');
      }
      if (!formData.manufacturer) {
        throw new Error('Manufacturer is required');
      }
      if (!formData.model.trim()) {
        throw new Error('Model is required');
      }

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          categoryId: parseInt(formData.categoryId),
          // If serial not required and left empty, auto-generate one
          serialNumber: formData.serialNumber.trim() || 'N/A',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create asset');
      }

      const asset = await response.json();
      router.push(`/assets/${asset.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHero
        eyebrow="Assets / Inventory"
        title="Add New Asset"
        description="Register a new asset in the inventory"
      />

      <div className="card max-w-2xl">
        <div className="card-body">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1: Pick Category First */}
            <div className="form-group">
              <label className="form-label text-lg font-semibold">What are you adding? *</label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="form-select text-lg py-3"
                required
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Show remaining fields only after category is selected */}
            {formData.categoryId && (
              <div className="space-y-4 pt-2 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  {/* Manufacturer - options change per category */}
                  <div className="form-group">
                    <label className="form-label">Manufacturer *</label>
                    <select
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleChange}
                      className="form-select"
                      required
                    >
                      <option value="">Select Manufacturer</option>
                      {manufacturers.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Model */}
                  <div className="form-group">
                    <label className="form-label">Model *</label>
                    <input
                      type="text"
                      name="model"
                      value={formData.model}
                      onChange={handleChange}
                      placeholder={
                        selectedCategory?.code === 'LAPTOP' ? 'e.g., Latitude 5550' :
                        selectedCategory?.code === 'MON' ? 'e.g., UltraSharp 27' :
                        selectedCategory?.code === 'MOB' ? 'e.g., iPhone 15 Pro' :
                        selectedCategory?.code === 'HEAD' ? 'e.g., WH-1000XM5' :
                        selectedCategory?.code === 'ACC' ? 'e.g., MX Master 3S' :
                        'e.g., model name'
                      }
                      className="form-input"
                      required
                    />
                  </div>

                  {/* Serial Number - required or optional based on category */}
                  <div className="form-group">
                    <label className="form-label">
                      Serial Number {serialRequired ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      name="serialNumber"
                      value={formData.serialNumber}
                      onChange={handleChange}
                      placeholder={serialRequired ? 'e.g., SN-DELL-001' : 'Leave blank if not available'}
                      className="form-input"
                      required={serialRequired}
                    />
                    {!serialRequired && (
                      <p className="text-xs text-gray-500 mt-1">
                        S/N not required for accessories — will be set to N/A if left blank
                      </p>
                    )}
                  </div>

                  {/* Condition */}
                  <div className="form-group">
                    <label className="form-label">Condition</label>
                    <select
                      name="condition"
                      value={formData.condition}
                      onChange={handleChange}
                      className="form-select"
                    >
                      <option value="NEW">New</option>
                      <option value="WORKING">Working</option>
                      <option value="DAMAGED">Damaged</option>
                      <option value="IN_REPAIR">In Repair</option>
                    </select>
                  </div>
                </div>

                {/* Purchase Price & Currency */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                  <div className="form-group">
                    <label className="form-label">Purchase Price</label>
                    <input
                      type="number"
                      name="purchasePrice"
                      value={formData.purchasePrice}
                      onChange={handleChange}
                      placeholder="e.g., 50000"
                      step="0.01"
                      min="0"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Currency</label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      className="form-select"
                    >
                      <option value="PKR">PKR (Pakistani Rupee)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="AED">AED (UAE Dirham)</option>
                    </select>
                  </div>
                </div>

                {/* Warranty Expiry */}
                <div className="form-group">
                  <label className="form-label">Warranty Expiry Date</label>
                  <input
                    type="date"
                    name="warrantyExpiry"
                    value={formData.warrantyExpiry}
                    onChange={handleChange}
                    className="form-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional. Leave blank if no warranty.
                  </p>
                </div>

                {/* Batch ID */}
                <div className="form-group">
                  <label className="form-label">Batch ID</label>
                  <input
                    type="text"
                    name="batchId"
                    value={formData.batchId}
                    onChange={handleChange}
                    placeholder="e.g., BATCH-2024-001"
                    className="form-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional. Group assets purchased together.
                  </p>
                </div>

                {/* Photo URL */}
                <div className="form-group">
                  <label className="form-label">Photo URL</label>
                  <input
                    type="url"
                    name="photoUrl"
                    value={formData.photoUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/photo.jpg"
                    className="form-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional. URL to asset photo.
                  </p>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Any additional details about this asset"
                    rows={3}
                    className="form-textarea"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary flex-1 justify-center disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add to Inventory'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="btn btn-secondary flex-1 justify-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
