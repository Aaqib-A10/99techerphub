'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import PageHero from '@/app/components/PageHero';

type Step = 'upload' | 'mapping' | 'preview' | 'results';

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

const COMMON_COLUMN_NAMES = [
  'empcode', 'emp_code', 'employee_code',
  'firstname', 'first_name',
  'lastname', 'last_name',
  'email', 'email_address',
  'phone', 'phone_number', 'contact',
  'cnic', 'id_number',
  'department', 'departmentcode', 'department_code',
  'designation', 'position',
  'employmentstatus', 'employment_status', 'status',
  'dateofjoining', 'date_of_joining', 'joining_date', 'startdate',
  'companycode', 'company_code', 'company',
  'location', 'office_location',
  'bankaccountnumber', 'bank_account',
  'basesalary', 'base_salary', 'salary',
];

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function autoDetectColumns(rows: ParsedRow[]): Record<string, string> {
  if (rows.length === 0) return {};

  const headers = Object.keys(rows[0]);
  const mapping: Record<string, string> = {};

  headers.forEach((header) => {
    const headerLower = header.toLowerCase();
    const standardName = COMMON_COLUMN_NAMES.find((name) =>
      headerLower.includes(name) || name.includes(headerLower)
    );
    if (standardName) {
      mapping[header] = standardName;
    }
  });

  return mapping;
}

export default function EmployeeImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);

        if (rows.length === 0) {
          setError('No data rows found in file');
          return;
        }

        setParsedRows(rows);
        const autoMapping = autoDetectColumns(rows);
        setColumnMapping(autoMapping);
        setStep('mapping');
      } catch (err) {
        setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
    };

    reader.readAsText(selectedFile);
  };

  const handleColumnMapping = (header: string, value: string) => {
    setColumnMapping({ ...columnMapping, [header]: value });
  };

  const handleProceedToPreview = () => {
    setStep('preview');
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/employees/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows, mapping: columnMapping }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Import failed');
      }

      const importResult = await res.json();
      setResult(importResult);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setParsedRows([]);
    setColumnMapping({});
    setResult(null);
    setError('');
  };

  return (
    <div>
      <PageHero
        eyebrow="People / Directory"
        title="Bulk Employee Import"
        description="Import multiple employees from CSV file"
      />

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      {/* Progress Indicator */}
      <div className="mb-8 flex justify-between items-center">
        {['Upload', 'Map Columns', 'Preview', 'Results'].map((label, idx) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                idx < ['upload', 'mapping', 'preview', 'results'].indexOf(step)
                  ? 'bg-green-100 text-green-700'
                  : idx === ['upload', 'mapping', 'preview', 'results'].indexOf(step)
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {idx < ['upload', 'mapping', 'preview', 'results'].indexOf(step) ? '✓' : idx + 1}
            </div>
            <span
              className={
                idx <= ['upload', 'mapping', 'preview', 'results'].indexOf(step)
                  ? 'text-gray-900 font-medium'
                  : 'text-gray-500'
              }
            >
              {label}
            </span>
            {idx < 3 && <div className="w-12 h-0.5 bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card">
          <div className="card-body">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-lg font-semibold text-gray-900 mb-2">Upload CSV File</p>
              <p className="text-sm text-gray-600 mb-4">
                Drag and drop or click to select a CSV file containing employee data
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="btn btn-primary cursor-pointer inline-block"
              >
                Select File
              </label>
              {file && (
                <p className="mt-4 text-sm text-gray-600">
                  Selected: <span className="font-semibold">{file.name}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <div className="card">
          <div className="card-header">
            <h2 className="section-heading">Map Columns</h2>
            <p className="text-sm text-gray-600 mt-1">
              Specify which columns contain employee data. Auto-detected columns are highlighted.
            </p>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {Object.keys(columnMapping).length > 0 ? (
                Object.keys(parsedRows[0] || {}).map((header) => (
                  <div key={header}>
                    <label className="form-label">{header}</label>
                    <select
                      className="form-input"
                      value={columnMapping[header] || ''}
                      onChange={(e) => handleColumnMapping(header, e.target.value)}
                    >
                      <option value="">-- Skip this column --</option>
                      <option value="empcode">Employee Code</option>
                      <option value="firstname">First Name</option>
                      <option value="lastname">Last Name</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="cnic">CNIC</option>
                      <option value="department">Department</option>
                      <option value="designation">Designation</option>
                      <option value="employmentstatus">Employment Status</option>
                      <option value="dateofjoining">Date of Joining</option>
                      <option value="company">Company</option>
                      <option value="location">Location</option>
                      <option value="bankaccountnumber">Bank Account Number</option>
                      <option value="basesalary">Base Salary</option>
                    </select>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No columns detected</p>
              )}
            </div>
          </div>
          <div className="card-footer flex gap-3">
            <button onClick={() => setStep('upload')} className="btn btn-secondary">
              Back
            </button>
            <button onClick={handleProceedToPreview} className="btn btn-primary">
              Continue to Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="card">
          <div className="card-header">
            <h2 className="section-heading">Preview Data</h2>
            <p className="text-sm text-gray-600 mt-1">
              Showing first 10 rows. Check for any errors before importing.
            </p>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-2 px-3 font-semibold">Code</th>
                    <th className="text-left py-2 px-3 font-semibold">First Name</th>
                    <th className="text-left py-2 px-3 font-semibold">Last Name</th>
                    <th className="text-left py-2 px-3 font-semibold">Email</th>
                    <th className="text-left py-2 px-3 font-semibold">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-3 font-mono text-xs">{row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'empcode') || ''] || '-'}</td>
                      <td className="py-2 px-3">{row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'firstname') || ''] || '-'}</td>
                      <td className="py-2 px-3">{row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'lastname') || ''] || '-'}</td>
                      <td className="py-2 px-3">{row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'email') || ''] || '-'}</td>
                      <td className="py-2 px-3">{row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'department') || ''] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 10 && (
              <p className="text-sm text-gray-600 mt-4">
                Showing 10 of {parsedRows.length} rows
              </p>
            )}
          </div>
          <div className="card-footer flex gap-3">
            <button onClick={() => setStep('mapping')} className="btn btn-secondary">
              Back
            </button>
            <button onClick={handleImport} disabled={loading} className="btn btn-primary">
              {loading ? 'Importing...' : 'Start Import'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 'results' && result && (
        <div className="card">
          <div className="card-header">
            <h2 className="section-heading">Import Results</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <p className="text-sm text-gray-600">Successful Imports</p>
                <p className="text-3xl font-bold text-green-700">{result.success}</p>
              </div>
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-sm text-gray-600">Failed Imports</p>
                <p className="text-3xl font-bold text-red-700">{result.failed}</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Errors</h3>
                <div className="bg-red-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {result.errors.map((err, idx) => (
                    <div key={idx} className="mb-2 text-sm">
                      <span className="font-semibold text-red-700">Row {err.row}:</span>
                      <span className="text-red-600 ml-2">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="card-footer">
            <button onClick={handleReset} className="btn btn-primary">
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
