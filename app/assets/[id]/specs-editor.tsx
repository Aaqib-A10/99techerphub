'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Suggested spec fields per category
const SPEC_SUGGESTIONS: Record<string, string[]> = {
  LAPTOP: ['RAM', 'Storage', 'Processor', 'Screen Size', 'OS', 'Graphics'],
  PC: ['RAM', 'Storage', 'Processor', 'OS', 'Graphics'],
  MON: ['Screen Size', 'Resolution', 'Panel Type', 'Refresh Rate'],
  MOB: ['Storage', 'Color', 'Screen Size', 'OS'],
  TAB: ['Storage', 'Screen Size', 'Color', 'OS'],
  HEAD: ['Type', 'Connectivity', 'Color'],
  ACC: ['Type', 'Connectivity', 'Color'],
  NET: ['Ports', 'Speed', 'Type'],
  FURN: ['Color', 'Material', 'Dimensions'],
  SW: ['License Type', 'Seats', 'Expiry'],
};

export default function AssetSpecsEditor({
  assetId,
  currentSpecs,
  categoryCode,
}: {
  assetId: number;
  currentSpecs: Record<string, string>;
  categoryCode: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [specs, setSpecs] = useState<Record<string, string>>(currentSpecs);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = SPEC_SUGGESTIONS[categoryCode] || ['Type', 'Color'];
  const unusedSuggestions = suggestions.filter((s) => !specs[s]);

  const addSpec = (key?: string) => {
    const specKey = key || newKey.trim();
    if (!specKey) return;
    setSpecs((prev) => ({ ...prev, [specKey]: newValue || '' }));
    setNewKey('');
    setNewValue('');
  };

  const removeSpec = (key: string) => {
    setSpecs((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const updateSpecValue = (key: string, value: string) => {
    setSpecs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter out empty values
      const cleanSpecs = Object.fromEntries(
        Object.entries(specs).filter(([_, v]) => v.trim() !== '')
      );

      const response = await fetch(`/api/assets/${assetId}/specs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specs: cleanSpecs }),
      });

      if (!response.ok) throw new Error('Failed to save specs');

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      alert('Failed to save specifications');
    } finally {
      setSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="mt-3 text-sm text-brand-primary hover:text-brand-secondary underline"
      >
        {Object.keys(currentSpecs).length > 0 ? 'Edit Specs' : '+ Add Specs'}
      </button>
    );
  }

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Existing specs - editable */}
      {Object.entries(specs).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700 w-28 shrink-0">{key}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => updateSpecValue(key, e.target.value)}
            placeholder={`Enter ${key.toLowerCase()}`}
            className="form-input text-sm flex-1"
          />
          <button
            onClick={() => removeSpec(key)}
            className="text-red-500 hover:text-red-700 text-sm px-2"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Quick-add suggested specs */}
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 mb-3">
          {unusedSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => addSpec(suggestion)}
              className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1 hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-colors"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Custom spec field */}
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Custom field name"
          className="form-input text-sm w-28"
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Value"
          className="form-input text-sm flex-1"
          onKeyDown={(e) => e.key === 'Enter' && addSpec()}
        />
        <button
          onClick={() => addSpec()}
          className="text-brand-primary text-sm font-medium hover:underline"
        >
          Add
        </button>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary text-sm px-4 py-1"
        >
          {saving ? 'Saving...' : 'Save Specs'}
        </button>
        <button
          onClick={() => {
            setSpecs(currentSpecs);
            setIsEditing(false);
          }}
          className="btn btn-secondary text-sm px-4 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
