const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();

// ── Company mapping (Excel "Bill To" → DB company ID) ──
const COMPANY_MAP: Record<string, number> = {
  'Minnesota Computers': 1,
  'Minnesota Computer': 1,
  'Minnesota Compuers': 1,
  'SJ Computers': 2,
  'SJ Computer': 2,
  'PC Mart': 3,
  'RTI': 4,
  'LRI': 5,
  'Eternal Perfumes': 7,
  '99Tech': 8,
  '99 Technologies': 8,
  'Medical Billing': 8,
  'World Wide Express': 8,
  'Multiple': null as any, // handled separately via employeeCompanies
};

// Multi-company mappings
const MULTI_COMPANY_MAP: Record<string, number[]> = {
  'Multiple': [1, 2, 4],
  'SJ Computers, Minnesota Computers': [2, 1],
  'SJ Computers, Minnesota Compuers, LRI, RTI': [2, 1, 5, 4],
  'SJ Computers,LRI,Minnesota Computers': [2, 5, 1],
  'Minnesota Computer, SJ Computers': [1, 2],
  'Minnesota Computer, SJ, RTI': [1, 2, 4],
  'LRI, RTI ,Minnesota Compuers, SJ Computers': [5, 4, 1, 2],
};

// ── Department mapping (Excel department → DB department ID) ──
const DEPT_MAP: Record<string, number> = {
  'Dev': 19,
  'Dev Department': 19,
  'Dev Department  ': 19,
  'Dev SJ Brain Box': 19,
  'Dev SJ Shipnest ': 19,
  'Dev-Account Wise': 19,
  'Shopify Specialist': 19,
  'Sales': 61,
  'Sales\u00a0': 61,
  'Sales Operation': 61,
  'SJ Sales': 61,
  'SJ Sales PT': 61,
  'SJ Sales Team A': 61,
  'SJ Sales Team B': 61,
  'SJ Sales LG': 61,
  'International Sale': 61,
  'International Sale ': 61,
  'Key Account-Sales EP': 61,
  'Customer Support': 10,
  'Customer Support (EP)': 10,
  'Customer Support EP': 10,
  'SJ Customer Support': 10,
  'EP': 69,
  'BD-EP': 69,
  'GD-EP': 69,
  'Content Writer-EP': 69,
  'Eternal Perfume': 69,
  'E Commerce': 69,
  'Digital Marketing': 25,
  'Digital Marketing ': 25,
  'Digital Marketing (EP)': 25,
  'DM - EP': 25,
  'DM - EZ': 25,
  'DM - RTI - EZ': 25,
  'DM - RTI - Eternal - EZ': 25,
  'SJ Email Marketing': 25,
  'LRI - NetSuite': 70,
  'LRI - Content Team': 70,
  'LRI - Collections': 70,
  'LRI - Billing': 70,
  'LRI Digital Team': 70,
  'Billing & Collection': 70,
  'Billing & Collection (Sales)': 70,
  'PC Mart': 76,
  ' Medical Billing Sales': 74,
  'Sales (Medical Billing)': 74,
  'Human Resource': 37,
  'Admin Dept': 81,
  'LG ': 61,
  'Talkloop': 73,
  'UI/UX': 19,
  'UX/UI ': 19,
};

// ── Employment status mapping ──
const STATUS_MAP: Record<string, string> = {
  'Permanent': 'PERMANENT',
  'Probation': 'PROBATION',
  'Internship': 'CONSULTANT', // closest match
};

// ── Exit type mapping ──
const EXIT_TYPE_MAP: Record<string, string> = {
  'Lay Off': 'TERMINATION',
  'Termination': 'TERMINATION',
  'Resign': 'RESIGNATION',
  'Resignation': 'RESIGNATION',
  'Job Complete': 'CONTRACT_END',
  'Internship Over': 'CONTRACT_END',
  'Intern END': 'CONTRACT_END',
};

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function getPrimaryCompanyId(billTo: string | null): number | null {
  if (!billTo) return null;
  const trimmed = billTo.trim();
  if (MULTI_COMPANY_MAP[trimmed]) return MULTI_COMPANY_MAP[trimmed][0];
  return COMPANY_MAP[trimmed] ?? null;
}

function getMultiCompanyIds(billTo: string | null): number[] {
  if (!billTo) return [];
  const trimmed = billTo.trim();
  if (MULTI_COMPANY_MAP[trimmed]) return MULTI_COMPANY_MAP[trimmed];
  const single = COMPANY_MAP[trimmed];
  return single ? [single] : [];
}

async function main() {
  const workbook = XLSX.readFile('/Users/aqib/Downloads/Exited employess.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  let imported = 0;
  let skipped = 0;
  let errors: string[] = [];

  for (const row of rows) {
    const empCode = row['Emp ID'];
    const name = row['Name'];

    // Skip empty rows
    if (!empCode || !name || empCode === 0) {
      skipped++;
      continue;
    }

    const empCodeStr = String(empCode).trim();
    const nameStr = String(name).trim();

    // Check if already exists
    const existing = await prisma.employee.findFirst({ where: { empCode: empCodeStr } });
    if (existing) {
      console.log(`SKIP (exists): ${empCodeStr} - ${nameStr}`);
      skipped++;
      continue;
    }

    const { firstName, lastName } = splitName(nameStr);
    const billTo = row['Bill To - Company Name'] ? String(row['Bill To - Company Name']).trim() : null;
    const deptName = row['Department'] ? String(row['Department']).trim() : null;
    const deptId = deptName ? (DEPT_MAP[deptName] ?? 68) : 68; // default to Unassigned
    const companyId = getPrimaryCompanyId(billTo);
    const companyIds = getMultiCompanyIds(billTo);
    const designation = row['Designation'] ? String(row['Designation']).trim() : 'N/A';
    const team = row['Team'] ? String(row['Team']).trim() : null;
    const empStatus = row['Employee Status'] ? STATUS_MAP[String(row['Employee Status']).trim()] : 'PERMANENT';
    const dateOfJoining = parseDate(row['Date of Joining']);
    const dateOfLeaving = parseDate(row['Left Date']);
    const exitReason = row['Reason'] ? String(row['Reason']).trim() : null;
    const exitType = exitReason ? (EXIT_TYPE_MAP[exitReason] ?? 'RESIGNATION') : 'RESIGNATION';
    const cnic = row['CNIC'] ? String(row['CNIC']).trim() : null;
    const bankName = row['Bank Name'] ? String(row['Bank Name']).trim() : null;
    const bankAccount = row['Bank Account'] ? String(row['Bank Account']).trim() : null;
    const bankStatus = row['Account Status'] ? String(row['Account Status']).trim() : null;
    const phone = row['Personal Contact No.'] ? String(row['Personal Contact No.']).trim() : null;
    const email = row['Personal Email'] ? String(row['Personal Email']).trim() : null;
    const emergencyPhone = row['Emergency Contact No. (Parents / Siblings)'] ? String(row['Emergency Contact No. (Parents / Siblings)']).trim() : null;
    const dateOfBirth = parseDate(row['Date of Birth']);
    const address = row['Current Address'] ? String(row['Current Address']).trim() : null;
    const permanentAddress = row['Permanant Address'] ? String(row['Permanant Address']).trim() : null;
    const lastDegree = row['Last Degree'] ? String(row['Last Degree']).trim() : null;
    const bloodGroup = row['Blood Group'] ? String(row['Blood Group']).trim() : null;
    const fatherName = row['Father Name'] ? String(row['Father Name']).trim() : null;
    const previousOrg = row['Previous Organization/Company Name'] ? String(row['Previous Organization/Company Name']).trim() : null;
    const referenceCheck = row['Reference Check Details from Previous Employer (Contact Person Name and official phone number)'] ? String(row['Reference Check Details from Previous Employer (Contact Person Name and official phone number)']).trim() : null;
    const probationEnd = parseDate(row['End of Probation']);

    if (!dateOfJoining) {
      console.log(`SKIP (no join date): ${empCodeStr} - ${nameStr}`);
      errors.push(`${empCodeStr}: Missing date of joining`);
      skipped++;
      continue;
    }

    // Unmapped department warning
    if (deptName && !DEPT_MAP[deptName]) {
      console.log(`  WARN: Unmapped department "${deptName}" for ${empCodeStr}, using Unassigned`);
    }

    // Unmapped company warning
    if (billTo && !getPrimaryCompanyId(billTo) && !MULTI_COMPANY_MAP[billTo]) {
      console.log(`  WARN: Unmapped company "${billTo}" for ${empCodeStr}`);
    }

    try {
      const employee = await prisma.employee.create({
        data: {
          empCode: empCodeStr,
          firstName,
          lastName,
          fatherName,
          email,
          phone,
          cnic,
          dateOfBirth,
          address,
          permanentAddress,
          departmentId: deptId,
          companyId,
          designation,
          team: team === '0' ? null : team,
          employmentStatus: empStatus as any,
          lifecycleStage: 'EXITED',
          dateOfJoining,
          dateOfLeaving,
          probationEndDate: probationEnd,
          exitReason,
          bankName,
          bankAccountNumber: bankAccount,
          bankAccountStatus: bankStatus,
          bloodGroup,
          lastDegree,
          previousOrganization: previousOrg,
          referenceCheck,
          emergencyContactPhone: emergencyPhone,
          isActive: false,
        },
      });

      // Create EmployeeExit record
      if (dateOfLeaving) {
        await prisma.employeeExit.create({
          data: {
            employeeId: employee.id,
            exitDate: dateOfLeaving,
            reason: exitReason,
            exitType,
            isComplete: true,
          },
        });
      }

      // Create EmployeeCompany records for billing
      for (const cId of companyIds) {
        await prisma.employeeCompany.create({
          data: {
            employeeId: employee.id,
            companyId: cId,
          },
        });
      }

      imported++;
      console.log(`OK: ${empCodeStr} - ${nameStr} → dept:${deptId} company:${companyId} exit:${exitType}`);
    } catch (e: any) {
      console.log(`ERROR: ${empCodeStr} - ${e.message.substring(0, 200)}`);
      errors.push(`${empCodeStr}: ${e.message.substring(0, 100)}`);
      skipped++;
    }
  }

  console.log(`\n========================================`);
  console.log(`IMPORT COMPLETE`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors.length}`);
  if (errors.length > 0) {
    console.log(`\nError details:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
  console.log(`========================================`);

  await prisma.$disconnect();
}

main().catch(console.error);
