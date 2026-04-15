const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();

// ── Company mapping (Excel "Bill To" → company name for DB lookup) ──
const COMPANY_NAME_MAP: Record<string, string> = {
  'Minnesota Computers': 'Minnesota Computers',
  'Minnesota Computer': 'Minnesota Computers',
  'Minnesota Compuers': 'Minnesota Computers',
  'SJ Computers': 'SJ Computers',
  'SJ Computer': 'SJ Computers',
  'PC Mart': 'PC Mart',
  'RTI': 'RTI',
  'LRI': 'LRI',
  'Eternal Perfumes': 'Eternal Perfumes',
  '99Tech': '99 Technologies',
  '99 Technologies': '99 Technologies',
  'Medical Billing': '99 Technologies',
  'World Wide Express': '99 Technologies',
  'Multiple': 'Minnesota Computers',
};

const MULTI_COMPANY_NAMES: Record<string, string[]> = {
  'Multiple': ['Minnesota Computers', 'SJ Computers', 'RTI'],
  'SJ Computers, Minnesota Computers': ['SJ Computers', 'Minnesota Computers'],
  'SJ Computers, Minnesota Compuers, LRI, RTI': ['SJ Computers', 'Minnesota Computers', 'LRI', 'RTI'],
  'SJ Computers,LRI,Minnesota Computers': ['SJ Computers', 'LRI', 'Minnesota Computers'],
  'Minnesota Computer, SJ Computers': ['Minnesota Computers', 'SJ Computers'],
  'Minnesota Computer, SJ, RTI': ['Minnesota Computers', 'SJ Computers', 'RTI'],
  'LRI, RTI ,Minnesota Compuers, SJ Computers': ['LRI', 'RTI', 'Minnesota Computers', 'SJ Computers'],
};

// ── Department mapping (Excel → department name/code for DB lookup) ──
const DEPT_NAME_MAP: Record<string, string> = {
  'Dev': 'Development',
  'Dev Department': 'Development',
  'Dev Department  ': 'Development',
  'Dev SJ Brain Box': 'Development',
  'Dev SJ Shipnest ': 'Development',
  'Dev SJ Shipnest': 'Development',
  'Dev-Account Wise': 'Development',
  'Shopify Specialist': 'Development',
  'UI/UX': 'Development',
  'UX/UI ': 'Development',
  'Sales': 'Sales',
  'Sales\u00a0': 'Sales',
  'Sales Operation': 'Sales',
  'SJ Sales': 'Sales',
  'SJ Sales PT': 'Sales',
  'SJ Sales Team A': 'Sales',
  'SJ Sales Team B': 'Sales',
  'SJ Sales LG': 'Sales',
  'International Sale': 'Sales',
  'International Sale ': 'Sales',
  'Key Account-Sales EP': 'Sales',
  'LG ': 'Sales',
  'LG': 'Sales',
  'Customer Support': 'Customer Support',
  'Customer Support (EP)': 'Customer Support',
  'Customer Support EP': 'Customer Support',
  'SJ Customer Support': 'Customer Support',
  'EP': 'EP',
  'BD-EP': 'EP',
  'GD-EP': 'EP',
  'Content Writer-EP': 'EP',
  'Eternal Perfume': 'EP',
  'E Commerce': 'EP',
  'Digital Marketing': 'Digital Marketing',
  'Digital Marketing ': 'Digital Marketing',
  'Digital Marketing (EP)': 'Digital Marketing',
  'DM - EP': 'Digital Marketing',
  'DM - EZ': 'Digital Marketing',
  'DM - RTI - EZ': 'Digital Marketing',
  'DM - RTI - Eternal - EZ': 'Digital Marketing',
  'SJ Email Marketing': 'Digital Marketing',
  'LRI - NetSuite': 'LRI',
  'LRI - Content Team': 'LRI',
  'LRI - Collections': 'LRI',
  'LRI - Billing': 'LRI',
  'LRI Digital Team': 'LRI',
  'Billing & Collection': 'LRI',
  'Billing & Collection (Sales)': 'LRI',
  'PC Mart': 'PCMart',
  ' Medical Billing Sales': 'MB',
  'Medical Billing Sales': 'MB',
  'Sales (Medical Billing)': 'MB',
  'Human Resource': 'Human Resources',
  'Admin Dept': 'Admin',
  'Talkloop': 'UT',
};

const STATUS_MAP: Record<string, string> = {
  'Permanent': 'PERMANENT',
  'Probation': 'PROBATION',
  'Internship': 'CONSULTANT',
};

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

async function main() {
  // Load companies and departments from DB dynamically
  const companies = await prisma.company.findMany();
  const departments = await prisma.department.findMany();

  console.log('=== DB Companies ===');
  companies.forEach((c: any) => console.log(c.id, c.name));
  console.log('\n=== DB Departments ===');
  departments.forEach((d: any) => console.log(d.id, d.name, d.code));

  function findCompanyId(billTo: string | null): number | null {
    if (!billTo) return null;
    const mapped = COMPANY_NAME_MAP[billTo.trim()];
    if (!mapped) return null;
    const company = companies.find((c: any) =>
      c.name.toLowerCase().includes(mapped.toLowerCase()) ||
      mapped.toLowerCase().includes(c.name.toLowerCase())
    );
    return company?.id ?? null;
  }

  function findMultiCompanyIds(billTo: string | null): number[] {
    if (!billTo) return [];
    const trimmed = billTo.trim();
    const multiNames = MULTI_COMPANY_NAMES[trimmed];
    if (multiNames) {
      return multiNames.map(name => {
        const c = companies.find((co: any) =>
          co.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(co.name.toLowerCase())
        );
        return c?.id;
      }).filter(Boolean) as number[];
    }
    const single = findCompanyId(billTo);
    return single ? [single] : [];
  }

  function findDeptId(deptName: string | null): number {
    if (!deptName) {
      const unassigned = departments.find((d: any) => d.code === 'UNASSIGNED' || d.name === 'Unassigned');
      return unassigned?.id ?? departments[0]?.id;
    }
    const mapped = DEPT_NAME_MAP[deptName.trim()] || deptName.trim();
    const dept = departments.find((d: any) =>
      d.name.toLowerCase() === mapped.toLowerCase() ||
      d.code.toLowerCase() === mapped.toLowerCase()
    );
    if (dept) return dept.id;
    const unassigned = departments.find((d: any) => d.code === 'UNASSIGNED' || d.name === 'Unassigned');
    return unassigned?.id ?? departments[0]?.id;
  }

  const workbook = XLSX.readFile('/home/erp/99tech-erp/scripts/Exited_employees.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const empCode = row['Emp ID'];
    const name = row['Name'];
    if (!empCode || !name || empCode === 0) { skipped++; continue; }

    const empCodeStr = String(empCode).trim();
    const nameStr = String(name).trim();

    const existing = await prisma.employee.findFirst({ where: { empCode: empCodeStr } });
    if (existing) { console.log('SKIP (exists):', empCodeStr); skipped++; continue; }

    const { firstName, lastName } = splitName(nameStr);
    const billTo = row['Bill To - Company Name'] ? String(row['Bill To - Company Name']).trim() : null;
    const deptName = row['Department'] ? String(row['Department']).trim() : null;
    const deptId = findDeptId(deptName);
    const companyId = findCompanyId(billTo);
    const companyIds = findMultiCompanyIds(billTo);
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

    const joinDate = dateOfJoining || new Date('1970-01-01');

    try {
      const employee = await prisma.employee.create({
        data: {
          empCode: empCodeStr,
          firstName, lastName, fatherName,
          email, phone, cnic, dateOfBirth,
          address, permanentAddress,
          departmentId: deptId,
          companyId,
          designation,
          team: team === '0' ? null : team,
          employmentStatus: empStatus as any,
          lifecycleStage: 'EXITED',
          dateOfJoining: joinDate,
          dateOfLeaving, probationEndDate: probationEnd,
          exitReason,
          bankName, bankAccountNumber: bankAccount, bankAccountStatus: bankStatus,
          bloodGroup, lastDegree, previousOrganization: previousOrg,
          referenceCheck, emergencyContactPhone: emergencyPhone,
          isActive: false,
        },
      });

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

      for (const cId of companyIds) {
        await prisma.employeeCompany.create({
          data: { employeeId: employee.id, companyId: cId },
        });
      }

      imported++;
      console.log('OK:', empCodeStr, '-', nameStr, '→ dept:', deptId, 'company:', companyId, 'exit:', exitType);
    } catch (e: any) {
      console.log('ERROR:', empCodeStr, '-', e.message.substring(0, 200));
      errors.push(empCodeStr + ': ' + e.message.substring(0, 100));
      skipped++;
    }
  }

  console.log('\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('  Imported:', imported);
  console.log('  Skipped:', skipped);
  if (errors.length) { console.log('  Errors:'); errors.forEach(e => console.log('  -', e)); }
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(console.error);
