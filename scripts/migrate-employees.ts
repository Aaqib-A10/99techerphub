const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();

// Company name → DB company ID mapping
const COMPANY_MAP: Record<string, number> = {
  'sj computers': 2,
  'sj computers - sales': 2,
  'sj computer': 2,
  'minnesota computers': 1,
  'minnesota computer': 1,
  'minnesota compuers': 1,
  'minnesota': 1,
  'minnesota dubai': 1,
  'mnc': 1,
  'pc mart': 3,
  'rti': 4,
  'lri': 5,
  'lighting resources': 5,
  'green loop': 6,
  'greenloop': 6,
  'eternal perfumes': 7,
  '99 technologies': 8,
  '99tech': 8,
  '99 tech': 8,
  'quickship': 2,
};

// Department name → DB department ID mapping
const DEPT_MAP: Record<string, number> = {
  'sj sales team': 61,
  'sj sales lg': 61,
  'sj sales team, lri': 61,
  'sj customer support': 10,
  'eternal perfumes': 69,
  'pc mart': 76,
  'dev department': 19,
  'mnc back office': 82,
  'rti': 71,
  'lri': 70,
  '99 tech': 78,
  'itad': 72,
  'decomrobotics': 75,
  'digital marketing': 25,
};

const STATUS_MAP: Record<string, string> = {
  'permanent': 'PERMANENT',
  'probation': 'PROBATION',
  'consultant': 'CONSULTANT',
};

function parseBillToCompanies(billTo: string): number[] {
  if (!billTo) return [];
  const companyIds = new Set<number>();
  const parts = billTo.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  for (const part of parts) {
    if (COMPANY_MAP[part] !== undefined) {
      companyIds.add(COMPANY_MAP[part]);
      continue;
    }
    const found = Object.entries(COMPANY_MAP).find(([key]) => part.includes(key) || key.includes(part));
    if (found) {
      companyIds.add(found[1]);
    } else {
      console.warn(`  WARNING: Unknown company in Bill To: "${part}"`);
    }
  }
  return Array.from(companyIds);
}

function parseDepartment(dept: string): number | null {
  if (!dept) return null;
  const key = dept.trim().toLowerCase();
  if (DEPT_MAP[key] !== undefined) return DEPT_MAP[key];
  const found = Object.entries(DEPT_MAP).find(([k]) => key.includes(k) || k.includes(key));
  if (found) return found[1];
  console.warn(`  WARNING: Unknown department: "${dept}"`);
  return null;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function parseDate(val: any): Date | null {
  if (!val || val === 'NaT') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function cleanString(val: any): string | null {
  if (val === null || val === undefined || val === '' || val === 'NaN' || (typeof val === 'number' && isNaN(val))) return null;
  return String(val).trim() || null;
}

async function main() {
  const workbook = XLSX.readFile('/Users/aqib/Downloads/Employees Data 15-04-26.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet) as any[];

  console.log(`\nExcel has ${rows.length} employee rows\n`);

  // Step 1: Delete all existing data (child tables first)
  console.log('--- Clearing existing data ---');

  // Delete in correct order to respect foreign keys
  const delCounts = {
    notifications: await prisma.notification.deleteMany(),
    requestLogs: await prisma.requestLog.deleteMany(),
    auditLogs: await prisma.auditLog.deleteMany(),
    monthlyReports: await prisma.monthlyReport.deleteMany(),
    billingSplits: await prisma.billingSplit.deleteMany(),
    payrollItems: await prisma.payrollItem.deleteMany(),
    payrollRuns: await prisma.payrollRun.deleteMany(),
    commissions: await prisma.commission.deleteMany(),
    deductions: await prisma.deduction.deleteMany(),
    salaryHistory: await prisma.salaryHistory.deleteMany(),
    expenseApprovals: await prisma.expenseApproval.deleteMany(),
    expenses: await prisma.expense.deleteMany(),
    documents: await prisma.employeeDocument.deleteMany(),
    digitalAccess: await prisma.digitalAccess.deleteMany(),
    onboardingTasks: await prisma.onboardingTask.deleteMany(),
    onboardingSubmissions: await prisma.onboardingSubmission.deleteMany(),
    assetTransfers: await prisma.assetTransfer.deleteMany(),
    assetAssignments: await prisma.assetAssignment.deleteMany(),
    exitRecords: await prisma.employeeExit.deleteMany(),
    offerLetters: await prisma.offerLetter.deleteMany(),
    employeeCompanies: await prisma.employeeCompany.deleteMany(),
    employees: await prisma.employee.deleteMany(),
  };

  for (const [table, result] of Object.entries(delCounts)) {
    if (result.count > 0) console.log(`  Deleted ${result.count} from ${table}`);
  }
  console.log('--- All employee data cleared ---\n');

  // Step 2: Insert fresh from Excel
  let created = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const empCode = String(row['Emp ID']).trim();
    const name = cleanString(row['Name']);
    if (!name) { skipped++; continue; }

    const { firstName, lastName } = splitName(name);
    const billTo = cleanString(row['Bill To - Company Name']) || '';
    const dept = cleanString(row['Department']);
    const deptId = parseDepartment(dept || '') || 68; // Default: Unassigned
    const billToCompanyIds = parseBillToCompanies(billTo);
    const primaryCompanyId = billToCompanyIds[0] || null;

    const employeeData: any = {
      empCode,
      firstName,
      lastName,
      fatherName: cleanString(row['Father Name']),
      team: cleanString(row['Team']),
      departmentId: deptId,
      companyId: primaryCompanyId,
      designation: cleanString(row['Designation']) || 'Unassigned',
      employmentStatus: STATUS_MAP[(cleanString(row['Employee Status']) || '').toLowerCase()] || 'PERMANENT',
      dateOfJoining: parseDate(row['Date of Joining']) || new Date(),
      probationEndDate: parseDate(row['End of Probation']),
      cnic: cleanString(row['CNIC']),
      bankName: cleanString(row['Bank Name']),
      bankAccountNumber: cleanString(row['Bank Account']),
      bankAccountStatus: cleanString(row['Account Status']),
      phone: cleanString(row['Personal Contact No.']),
      email: cleanString(row['Personal Email']),
      emergencyContactPhone: cleanString(row['Emergency Contact No. (Parents / Siblings)']),
      dateOfBirth: parseDate(row['Date of Birth']),
      address: cleanString(row['Current Address']),
      permanentAddress: cleanString(row['Permanant Address']),
      lastDegree: cleanString(row['Last Degree']),
      bloodGroup: cleanString(row['Blood Group']),
      previousOrganization: cleanString(row['Previous Organization/Company Name']),
      referenceCheck: cleanString(row['Reference Check Details from Previous Employer (Contact Person Name and official phone number)']),
    };

    try {
      const newEmp = await prisma.employee.create({ data: employeeData });

      // Create employee_companies junction records
      for (const compId of billToCompanyIds) {
        await prisma.employeeCompany.create({
          data: { employeeId: newEmp.id, companyId: compId },
        });
      }

      created++;
      console.log(`Created: ${empCode} - ${name} | Bill To: [${billToCompanyIds.join(',')}] | Dept: ${deptId}`);
    } catch (err: any) {
      errors++;
      console.error(`ERROR for ${empCode} (${name}): ${err.message?.slice(0, 300)}`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Migration Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
  console.log(`   Total:   ${rows.length}`);
  console.log(`${'='.repeat(50)}\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
