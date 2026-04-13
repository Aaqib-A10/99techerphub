/**
 * 99 Tech Master Inventory Import
 * ================================
 * Reads prisma/master-inventory-data.json (pre-parsed from the real uploads)
 * and loads it into the ERP database.
 *
 * Steps:
 *  1. Wipe dummy data from all mutable tables (keeping users/templates)
 *  2. Upsert companies (MNC, SJ, PCMART, RTI, LRI, Green Loop, EP, etc.)
 *  3. Upsert departments (discovered from the sheet)
 *  4. Upsert locations (Islamabad, Dubai, Eagan-MN)
 *  5. Upsert asset categories (Laptop, Monitor, Desktop, Accessories, Networking)
 *  6. Insert all active + exited employees
 *  7. Insert all assets (laptops/monitors/desktops/accessories)
 *  8. Fuzzy-match asset owners to employees and create AssetAssignment records
 *  9. Print a verification report
 *
 * Safe to re-run: it wipes and rebuilds everything except users.
 */

import { PrismaClient, AssetCondition, EmploymentStatus, EmployeeLifecycleStage } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DATA_PATH = path.join(__dirname, 'master-inventory-data.json');

type RawEmployee = {
  'Sr No..+'?: number;
  'Sr No.'?: number;
  'Emp ID': string;
  'Name': string;
  'Father Name'?: string | null;
  'Team'?: string | null;
  'Bill To - Company Name'?: string | null;
  'Department'?: string | null;
  'Designation'?: string | null;
  'Employee Status'?: string | null;
  'Date of Joining'?: string | null;
  'End of Probation'?: string | null;
  'CNIC'?: string | null;
  'Bank Name'?: string | null;
  'Bank Account'?: string | null;
  'Account Status'?: string | null;
  'Personal Contact No.'?: string | null;
  'Personal Email'?: string | null;
  'Emergency Contact No. (Parents / Siblings)'?: string | null;
  'Date of Birth'?: string | null;
  'Current Address'?: string | null;
  'Permanant Address'?: string | null;
  'Last Degree'?: string | null;
  'Blood Group'?: string | null;
  'Previous Organization/Company Name'?: string | null;
  [k: string]: any;
};

type RawLaptop = {
  assetTag: string;
  type?: string | null;
  manufacturer?: string | null;
  serialNumber?: string | null;
  description?: string | null;
  batch?: string | null;
  employeeName?: string | null;
  comments?: string | null;
};

type RawMonitor = {
  assetTag: string;
  manufacturer?: string | null;
  serialNumber?: string | null;
  size?: string | null;
  department?: string | null;
  employeeName?: string | null;
  qty?: number | null;
};

type RawDesktop = {
  assetTag: string;
  manufacturer?: string | null;
  serialNumber?: string | null;
  model?: string | null;
  description?: string | null;
  employeeName?: string | null;
  department?: string | null;
  accessories?: string | null;
};

type RawAccessory = {
  assetTag: string;
  type: string;
  manufacturer?: string | null;
  description?: string | null;
  employeeName?: string | null;
  department?: string | null;
};

type Payload = {
  generated_at: string;
  employees_active: RawEmployee[];
  employees_exited: RawEmployee[];
  laptops: RawLaptop[];
  monitors: RawMonitor[];
  desktops: RawDesktop[];
  accessories: RawAccessory[];
};

// ========= HELPERS =========

function splitName(full: string): { firstName: string; lastName: string } {
  const clean = (full || '').trim().replace(/\s+/g, ' ');
  if (!clean) return { firstName: 'Unknown', lastName: '' };
  const parts = clean.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  if (typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (!trimmed || trimmed.toUpperCase() === 'N/A' || trimmed === 'Nil' || trimmed === 'NIL') return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d;
}

function mapEmploymentStatus(raw?: string | null): EmploymentStatus {
  if (!raw) return EmploymentStatus.PERMANENT;
  const v = raw.toLowerCase();
  if (v.includes('probation')) return EmploymentStatus.PROBATION;
  if (v.includes('consultant')) return EmploymentStatus.CONSULTANT;
  return EmploymentStatus.PERMANENT;
}

// Normalize a name for fuzzy matching: lowercase, collapse whitespace, remove titles
function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|dr|sir|madam|miss)\b\.?/g, '')
    .replace(/\([^)]*\)/g, '') // remove (KM), (Home), etc.
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tokens for matching — set of lowercased significant words
function nameTokens(name: string): Set<string> {
  const s = normalizeName(name);
  return new Set(s.split(' ').filter(t => t.length >= 3));
}

// ========= COMPANY MAPPING =========
// Maps "Bill To - Company Name" values from the sheet to one of the 6 sub-companies.
const COMPANY_NAMES: Record<string, { code: string; name: string; country: string }> = {
  'MNC': { code: 'MNC', name: 'Minnesota Computers', country: 'USA' },
  'SJ': { code: 'SJ', name: 'SJ Computers', country: 'USA' },
  'PCMART': { code: 'PCM', name: 'PC Mart', country: 'USA' },
  'RTI': { code: 'RTI', name: 'RTI', country: 'USA' },
  'LRI': { code: 'LRI', name: 'Lighting Resources', country: 'USA' },
  'GREEN_LOOP': { code: 'GL', name: 'Green Loop', country: 'USA' },
  'EP': { code: 'EP', name: 'Eternal Perfumes', country: 'USA' },
  'NINETY_NINE': { code: '99T', name: '99 Technologies', country: 'Pakistan' },
};

function resolveCompanyKey(billTo?: string | null): string {
  if (!billTo) return 'NINETY_NINE';
  const v = billTo.toLowerCase();
  if (v.includes('minnesota') || v === 'mnc') return 'MNC';
  if (v.includes('sj')) return 'SJ';
  if (v.includes('pc mart') || v.includes('pcmart') || v.includes('pcm')) return 'PCMART';
  if (v.includes('rti')) return 'RTI';
  if (v.includes('lri') || v.includes('lighting')) return 'LRI';
  if (v.includes('green loop') || v.includes('greenloop')) return 'GREEN_LOOP';
  if (v.includes('eternal')) return 'EP';
  if (v.includes('decom')) return 'NINETY_NINE'; // Decomrobotics → 99 Tech parent
  return 'NINETY_NINE';
}

// ========= MAIN =========

async function main() {
  console.log('================================');
  console.log('99 Tech Master Inventory Import');
  console.log('================================\n');

  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Data file not found: ${DATA_PATH}`);
  }
  const payload: Payload = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`Loaded data generated at: ${payload.generated_at}`);
  console.log(`  Active employees: ${payload.employees_active.length}`);
  console.log(`  Exit employees:   ${payload.employees_exited.length}`);
  console.log(`  Laptops:          ${payload.laptops.length}`);
  console.log(`  Monitors:         ${payload.monitors.length}`);
  console.log(`  Desktops:         ${payload.desktops.length}`);
  console.log(`  Accessories:      ${payload.accessories.length}\n`);

  // ---- STEP 1: WIPE ----
  console.log('[1/8] Wiping existing data...');
  await prisma.assetAssignment.deleteMany();
  await prisma.assetTransfer.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.digitalAccess.deleteMany();
  await prisma.employeeExit.deleteMany();
  await prisma.onboardingSubmission.deleteMany();
  await prisma.offerLetter.deleteMany();
  await prisma.expenseApproval.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.payrollItem.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.deduction.deleteMany();
  await prisma.salaryHistory.deleteMany();
  await prisma.billingSplit.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  // Detach employeeId from users, then delete employees
  await prisma.user.updateMany({ data: { employeeId: null } });
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.location.deleteMany();
  await prisma.assetCategory.deleteMany();
  await prisma.company.deleteMany();
  console.log('  ✓ All mutable tables cleared\n');

  // ---- STEP 2: COMPANIES ----
  console.log('[2/8] Seeding companies...');
  const companies: Record<string, number> = {};
  for (const [key, info] of Object.entries(COMPANY_NAMES)) {
    const c = await prisma.company.create({
      data: { code: info.code, name: info.name, country: info.country },
    });
    companies[key] = c.id;
    console.log(`  ✓ ${info.code} — ${info.name}`);
  }
  console.log('');

  // ---- STEP 3: DEPARTMENTS ----
  console.log('[3/8] Seeding departments (discovering from employee sheet)...');
  const departmentSet = new Set<string>();
  for (const e of [...payload.employees_active, ...payload.employees_exited]) {
    const d = (e['Department'] || '').trim();
    if (d) departmentSet.add(d);
  }
  // Fallback/generic ones
  ['Operations', 'Administration', 'HR', 'Finance', 'Unassigned'].forEach(d => departmentSet.add(d));

  const departments: Record<string, number> = {};
  for (const deptName of Array.from(departmentSet).sort()) {
    const code = deptName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .slice(0, 20);
    try {
      const d = await prisma.department.create({
        data: { name: deptName, code: code || 'DEPT' },
      });
      departments[deptName] = d.id;
    } catch (e) {
      // Skip duplicates silently
    }
  }
  console.log(`  ✓ ${Object.keys(departments).length} departments seeded\n`);

  // ---- STEP 4: LOCATIONS ----
  console.log('[4/8] Seeding locations...');
  const locations: Record<string, number> = {};
  const locList = [
    { name: 'Islamabad HQ', country: 'Pakistan', address: 'Islamabad, Pakistan' },
    { name: 'Dubai Office', country: 'UAE', address: 'Dubai, UAE' },
    { name: 'Eagan, MN', country: 'USA', address: 'Eagan, Minnesota, USA' },
    { name: 'Home Office', country: 'Pakistan', address: 'Remote/WFH' },
    { name: 'Storage / Pool', country: 'Pakistan', address: '99 Tech stock room' },
  ];
  for (const l of locList) {
    const loc = await prisma.location.create({ data: l });
    locations[l.name] = loc.id;
  }
  console.log(`  ✓ ${Object.keys(locations).length} locations seeded\n`);

  // ---- STEP 5: ASSET CATEGORIES ----
  console.log('[5/8] Seeding asset categories...');
  const categories: Record<string, number> = {};
  const catList = [
    { name: 'Laptop', code: 'LAP', description: 'Portable computers' },
    { name: 'Monitor', code: 'MON', description: 'External displays and LCDs' },
    { name: 'Desktop', code: 'DSK', description: 'Desktops and mini PCs (Brain Box)' },
    { name: 'Accessories', code: 'ACC', description: 'Mice, keyboards, headphones, webcams, docks' },
    { name: 'Networking', code: 'NET', description: 'Switches, routers, servers, firewalls' },
  ];
  for (const c of catList) {
    const cat = await prisma.assetCategory.create({ data: c });
    categories[c.name] = cat.id;
  }
  console.log(`  ✓ ${Object.keys(categories).length} categories seeded\n`);

  // ---- STEP 6: EMPLOYEES ----
  console.log('[6/8] Importing employees...');
  const employeesByCode: Record<string, number> = {};
  const employeesById: { id: number; empCode: string; fullName: string; tokens: Set<string> }[] = [];

  const str = (v: any): string => (v === null || v === undefined ? '' : String(v)).trim();

  const importEmployee = async (e: RawEmployee, isExited: boolean) => {
    const empCode = str(e['Emp ID']);
    if (!empCode) return;
    const fullName = str(e['Name']);
    const { firstName, lastName } = splitName(fullName);

    const deptName = str(e['Department']) || 'Unassigned';
    const deptId = departments[deptName] ?? departments['Unassigned'];
    if (!deptId) throw new Error(`No department found for: ${deptName}`);

    const companyKey = resolveCompanyKey(e['Bill To - Company Name']);
    const companyId = companies[companyKey];

    const nullable = (v: any): string | null => {
      const s = str(v);
      return s && s.toUpperCase() !== 'N/A' && s.toLowerCase() !== 'nil' ? s : null;
    };

    const designation = nullable(e['Designation']) || 'Employee';
    // Parse dates safely (handle numbers too)
    const doj = parseDate(typeof e['Date of Joining'] === 'string' ? e['Date of Joining'] : null);
    const dob = parseDate(typeof e['Date of Birth'] === 'string' ? e['Date of Birth'] : null);
    const prob = parseDate(typeof e['End of Probation'] === 'string' ? e['End of Probation'] : null);
    const leftDate = parseDate(typeof (e as any)['Left Date'] === 'string' ? (e as any)['Left Date'] : null);

    try {
      const created = await prisma.employee.create({
        data: {
          empCode,
          firstName,
          lastName,
          fatherName: nullable(e['Father Name']),
          email: nullable(e['Personal Email']),
          phone: nullable(e['Personal Contact No.']),
          cnic: nullable(e['CNIC']),
          dateOfBirth: dob,
          address: nullable(e['Current Address']),
          permanentAddress: nullable(e['Permanant Address']),
          emergencyContactPhone: nullable(e['Emergency Contact No. (Parents / Siblings)']),
          departmentId: deptId,
          companyId,
          locationId: locations['Islamabad HQ'],
          designation,
          team: nullable(e['Team']),
          employmentStatus: mapEmploymentStatus(nullable(e['Employee Status'])),
          lifecycleStage: isExited ? EmployeeLifecycleStage.EXITED : EmployeeLifecycleStage.ACTIVE,
          dateOfJoining: doj || new Date('2023-01-01'),
          probationEndDate: prob,
          dateOfLeaving: isExited ? leftDate : null,
          exitReason: isExited ? nullable((e as any)['Reason']) : null,
          bankName: nullable(e['Bank Name']),
          bankAccountNumber: nullable(e['Bank Account']),
          bankAccountStatus: nullable(e['Account Status']),
          bloodGroup: nullable(e['Blood Group']),
          lastDegree: nullable(e['Last Degree']),
          previousOrganization: nullable(e['Previous Organization/Company Name']),
          referenceCheck: nullable(
            e['Reference Check Details from Previous Employer (Contact Person Name and official phone number)']
          ),
          isActive: !isExited,
        },
      });
      employeesByCode[empCode] = created.id;
      employeesById.push({
        id: created.id,
        empCode,
        fullName,
        tokens: nameTokens(fullName),
      });
    } catch (err: any) {
      console.warn(`    ⚠ Skipping ${empCode} (${fullName}): ${err.message.split('\n')[0]}`);
    }
  };

  for (const e of payload.employees_active) await importEmployee(e, false);
  for (const e of payload.employees_exited) await importEmployee(e, true);

  console.log(`  ✓ ${employeesById.length} employees imported`);
  const activeCount = await prisma.employee.count({ where: { isActive: true } });
  const exitedCount = await prisma.employee.count({ where: { isActive: false } });
  console.log(`    - Active: ${activeCount}`);
  console.log(`    - Exited: ${exitedCount}\n`);

  // ---- STEP 7: ASSETS ----
  console.log('[7/8] Importing assets...');

  // Fuzzy match a name string to an imported employee
  const resolveEmployee = (rawName: string | null | undefined): number | null => {
    if (!rawName) return null;
    const cleanN = rawName.trim();
    if (!cleanN) return null;
    const lowered = cleanN.toLowerCase();
    // Skip placeholder values
    if (['available', 'damage', 'damaged', 'retired', 'n/a', 'na', 'qsim sir house', "qasim sir house"].includes(lowered))
      return null;
    if (lowered.includes('home') && lowered.length < 25) return null; // "Home Office", "xxx Home"

    const targetTokens = nameTokens(cleanN);
    if (targetTokens.size === 0) return null;

    let bestMatch: { id: number; score: number } | null = null;
    for (const emp of employeesById) {
      // Overlap score: # shared tokens / min(target,emp)
      let shared = 0;
      for (const t of targetTokens) if (emp.tokens.has(t)) shared++;
      if (shared === 0) continue;
      const score = shared / Math.min(targetTokens.size, emp.tokens.size || 1);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { id: emp.id, score };
      }
    }
    // Require at least 0.5 confidence and at least 1 shared significant token
    return bestMatch && bestMatch.score >= 0.5 ? bestMatch.id : null;
  };

  let assetsCreated = 0;
  let assignmentsCreated = 0;
  let unresolvedAssignments = 0;

  const createAsset = async (args: {
    assetTag: string;
    serialNumber: string;
    categoryName: string;
    manufacturer: string;
    model: string;
    description?: string | null;
    batch?: string | null;
    employeeName?: string | null;
    comments?: string | null;
    specs?: any;
  }) => {
    const {
      assetTag,
      serialNumber,
      categoryName,
      manufacturer,
      model,
      description,
      batch,
      employeeName,
      comments,
      specs,
    } = args;

    // Determine condition from comments/name
    let condition: AssetCondition = AssetCondition.WORKING;
    const rawName = (employeeName || '').toLowerCase();
    const rawComment = (comments || '').toLowerCase();
    if (rawName.includes('damage') || rawComment.includes('damage')) condition = AssetCondition.DAMAGED;
    if (rawName.includes('retired') || rawComment.includes('retired')) condition = AssetCondition.RETIRED;
    if (rawComment.includes('repair')) condition = AssetCondition.IN_REPAIR;

    const resolvedEmpId = resolveEmployee(employeeName);
    const isAssigned = !!resolvedEmpId;

    try {
      const asset = await prisma.asset.create({
        data: {
          assetTag,
          serialNumber: serialNumber || 'UNKNOWN',
          categoryId: categories[categoryName],
          manufacturer: manufacturer || 'Unknown',
          model: model || 'Unknown',
          description,
          condition,
          batchId: batch,
          assignedToName: !isAssigned && employeeName ? employeeName : null,
          isAssigned,
          isRetired: condition === AssetCondition.RETIRED,
          locationId: locations['Islamabad HQ'],
          specs,
          notes: comments,
        },
      });
      assetsCreated++;

      if (resolvedEmpId) {
        await prisma.assetAssignment.create({
          data: {
            assetId: asset.id,
            employeeId: resolvedEmpId,
            conditionAtAssignment: condition,
            notes: 'Imported from Master Inventory Sheet',
          },
        });
        assignmentsCreated++;
      } else if (employeeName && !['available', 'damage', 'retired asset', 'n/a'].includes(rawName)) {
        unresolvedAssignments++;
      }
    } catch (err: any) {
      console.warn(`    ⚠ Asset ${assetTag}: ${err.message.split('\n')[0]}`);
    }
  };

  // Laptops
  console.log('  Importing laptops...');
  for (const l of payload.laptops) {
    const isTablet = (l.type || '').toLowerCase() === 'tablet';
    await createAsset({
      assetTag: l.assetTag,
      serialNumber: l.serialNumber || `UNK-${l.assetTag}`,
      categoryName: isTablet ? 'Accessories' : 'Laptop',
      manufacturer: l.manufacturer || 'Unknown',
      model: l.description || 'Unknown',
      description: l.description,
      batch: l.batch,
      employeeName: l.employeeName,
      comments: l.comments,
    });
  }
  // Monitors
  console.log('  Importing monitors...');
  for (const m of payload.monitors) {
    await createAsset({
      assetTag: m.assetTag,
      serialNumber: m.serialNumber || `UNK-${m.assetTag}`,
      categoryName: 'Monitor',
      manufacturer: m.manufacturer || 'Unknown',
      model: m.size ? `${m.size} display` : 'Monitor',
      description: m.size ? `${m.size} monitor` : null,
      employeeName: m.employeeName,
      specs: m.size ? { size: m.size } : undefined,
    });
  }
  // Desktops
  console.log('  Importing desktops...');
  for (const d of payload.desktops) {
    await createAsset({
      assetTag: d.assetTag,
      serialNumber: d.serialNumber || `UNK-${d.assetTag}`,
      categoryName: 'Desktop',
      manufacturer: d.manufacturer || 'Unknown',
      model: String(d.model || 'Mini PC'),
      description: d.description,
      employeeName: d.employeeName,
      comments: d.accessories,
    });
  }
  // Accessories
  console.log('  Importing accessories...');
  for (const a of payload.accessories) {
    await createAsset({
      assetTag: a.assetTag,
      serialNumber: `UNK-${a.assetTag}`,
      categoryName: 'Accessories',
      manufacturer: a.manufacturer || 'Unknown',
      model: a.type,
      description: a.description,
      employeeName: a.employeeName,
      specs: { accessoryType: a.type },
    });
  }

  console.log(`\n  ✓ ${assetsCreated} assets created`);
  console.log(`  ✓ ${assignmentsCreated} assets auto-assigned to employees`);
  console.log(`  ⚠ ${unresolvedAssignments} assets had a holder name but couldn't be matched (kept as assignedToName)\n`);

  // ---- STEP 8: VERIFY ----
  console.log('[8/8] Verification report:');
  const finalEmpCount = await prisma.employee.count();
  const finalAssetCount = await prisma.asset.count();
  const finalAssignCount = await prisma.assetAssignment.count();
  const byCategory = await prisma.asset.groupBy({
    by: ['categoryId'],
    _count: true,
  });
  const catLookup = await prisma.assetCategory.findMany();
  const catMap = Object.fromEntries(catLookup.map(c => [c.id, c.name]));

  console.log(`  Total employees:    ${finalEmpCount}`);
  console.log(`  Total assets:       ${finalAssetCount}`);
  console.log(`  Total assignments:  ${finalAssignCount}`);
  console.log(`  Assets by category:`);
  for (const row of byCategory) {
    console.log(`    - ${catMap[row.categoryId]}: ${row._count}`);
  }

  console.log('\n✅ Import complete!\n');
}

main()
  .catch((e) => {
    console.error('❌ Import failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
