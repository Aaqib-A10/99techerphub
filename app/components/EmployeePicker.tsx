'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface PickerEmployee {
  id: number;
  empCode: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  designation?: string | null;
  isActive?: boolean | null;
  department?: { name?: string | null } | null;
}

interface EmployeePickerProps {
  employees: PickerEmployee[];
  /** Selected employee id (number or stringified). Empty/null clears. */
  value: number | string | null | undefined;
  onChange: (id: number | null) => void;
  placeholder?: string;
  className?: string;
  /** Hide these employee ids from the suggestions (e.g. self, already assigned). */
  excludeIds?: number[];
  /** When false, only `isActive === true` employees show up. Default true (show all). */
  showInactive?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Max suggestions shown at once. Default 12. */
  maxResults?: number;
}

function normalize(s: string | null | undefined): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function fullName(e: PickerEmployee): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

/**
 * Searchable combobox for picking a single employee.
 * Replaces large `<select>` dropdowns. Searches by name, empCode,
 * email, designation, and department.
 *
 * Keyboard:
 *   ↓ / ↑   Move highlight
 *   Enter   Select highlighted
 *   Esc     Close
 *   Tab     Close (and pick if highlighted)
 */
export default function EmployeePicker({
  employees,
  value,
  onChange,
  placeholder = 'Search by name, code, email…',
  className = '',
  excludeIds = [],
  showInactive = true,
  required = false,
  disabled = false,
  maxResults = 12,
}: EmployeePickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve current selection
  const selectedId = value === null || value === undefined || value === '' ? null : Number(value);
  const selected = useMemo(
    () => (selectedId == null ? null : employees.find((e) => e.id === selectedId) || null),
    [selectedId, employees]
  );

  // Reflect external value -> input text when not actively searching
  useEffect(() => {
    if (!open && selected) {
      setQuery(`${fullName(selected)} (${selected.empCode})`);
    } else if (!open && !selected) {
      setQuery('');
    }
  }, [open, selected]);

  // Filter
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const pool = employees.filter((e) => {
      if (excludeSet.has(e.id)) return false;
      if (!showInactive && e.isActive === false) return false;
      return true;
    });

    // If the current query exactly matches the selected one, treat as empty so
    // the user sees all options when refocusing.
    const isCurrentSelectionText =
      selected && q === normalize(`${fullName(selected)} (${selected.empCode})`);
    if (!q || isCurrentSelectionText) return pool.slice(0, maxResults);

    return pool
      .map((e) => {
        const haystack = [
          e.empCode,
          fullName(e),
          e.email,
          e.designation,
          e.department?.name,
        ]
          .map(normalize)
          .join(' ');
        // Score: exact empCode match wins; then "starts with name"; then contains
        let score = 0;
        if (normalize(e.empCode) === q) score += 100;
        else if (normalize(e.empCode).startsWith(q)) score += 60;
        if (normalize(fullName(e)).startsWith(q)) score += 40;
        if (haystack.includes(q)) score += 10;
        // word-boundary bonus
        if (haystack.split(' ').some((w) => w.startsWith(q))) score += 5;
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((x) => x.e);
  }, [query, employees, excludeSet, showInactive, maxResults, selected]);

  // Clamp highlight when filtered changes
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered.length, highlight]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const pick = (emp: PickerEmployee | undefined) => {
    if (!emp) return;
    onChange(emp.id);
    setQuery(`${fullName(emp)} (${emp.empCode})`);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) pick(filtered[highlight]);
      else setOpen(true);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        {/* Search icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-core-text3 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !selected}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="employee-picker-list"
          className="form-input pl-9 pr-9 w-full"
          autoComplete="off"
        />
        {/* Clear button */}
        {selected && !disabled && (
          <button
            type="button"
            onClick={clear}
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-core-surface2 text-core-text3 hover:text-core-text2"
            aria-label="Clear selection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul
          id="employee-picker-list"
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-md border border-core-border bg-core-surface shadow-lg"
        >
          {filtered.map((e, idx) => {
            const isHi = idx === highlight;
            const isSel = selected?.id === e.id;
            return (
              <li
                key={e.id}
                role="option"
                aria-selected={isSel}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  pick(e);
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`px-3 py-2 cursor-pointer text-sm border-b border-gray-50 last:border-0 ${
                  isHi ? 'bg-core-text/10' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-core-text truncate">
                      {fullName(e)}
                      {e.isActive === false && (
                        <span className="ml-2 text-[10px] text-core-roseFg font-normal uppercase tracking-wide">
                          inactive
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-core-text3 truncate">
                      <span className="mono">{e.empCode}</span>
                      {e.designation ? ` · ${e.designation}` : ''}
                      {e.department?.name ? ` · ${e.department.name}` : ''}
                    </div>
                  </div>
                  {isSel && (
                    <span className="text-xs text-core-text2 font-semibold flex-shrink-0">
                      ✓
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-core-border bg-core-surface shadow-lg px-3 py-2 text-sm text-core-text3">
          No employees match &ldquo;{query.trim()}&rdquo;
        </div>
      )}
    </div>
  );
}
