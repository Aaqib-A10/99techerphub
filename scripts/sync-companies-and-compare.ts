const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Load local mappings
  const mappings: Record<string, string[]> = JSON.parse(
    fs.readFileSync(__dirname + '/employee_company_mappings.json', 'utf8')
  );

  // Get all companies from this DB
  const companies = await prisma.company.findMany();
  console.log('=== DB Companies ===');
  companies.forEach((c: any) => console.log(c.id, c.name));

  // Build name lookup (fuzzy match)
  function findCompanyId(name: string): number | null {
    const lower = name.toLowerCase();
    const c = companies.find((co: any) =>
      co.name.toLowerCase().includes(lower) ||
      lower.includes(co.name.toLowerCase())
    );
    return c?.id ?? null;
  }

  // Special mappings for name differences between local and production
  const NAME_MAP: Record<string, string> = {
    'Minnesota Computers': 'Minnesota Computers',
    'SJ Computers': 'SJ Computers',
    'PC Mart': 'PC Mart',
    'RTI': 'RTI',
    'Lighting Resources': 'LRI',
    'Eternal Perfumes': 'Eternal Perfumes',
    '99 Technologies': '99 Technologies',
    'Green Loop': 'Green Loop',
  };

  function resolveCompanyId(localName: string): number | null {
    // Try direct match first
    let id = findCompanyId(localName);
    if (id) return id;
    // Try mapped name
    const mapped = NAME_MAP[localName];
    if (mapped) id = findCompanyId(mapped);
    return id;
  }

  // STEP 1: Sync employee_companies
  console.log('\n=== SYNCING EMPLOYEE COMPANIES ===');
  let added = 0, skipped = 0, notFound = 0;

  // Clear existing employee_companies
  const deleted = await prisma.employeeCompany.deleteMany();
  console.log('Cleared', deleted.count, 'existing mappings');

  for (const [empCode, companyNames] of Object.entries(mappings)) {
    const employee = await prisma.employee.findFirst({ where: { empCode } });
    if (!employee) {
      console.log('SKIP (no employee):', empCode);
      notFound++;
      continue;
    }

    for (const compName of companyNames) {
      const companyId = resolveCompanyId(compName);
      if (!companyId) {
        console.log('  WARN: No company match for "' + compName + '" (emp: ' + empCode + ')');
        continue;
      }

      try {
        await prisma.employeeCompany.create({
          data: { employeeId: employee.id, companyId },
        });
        added++;
      } catch (e: any) {
        if (e.code === 'P2002') {
          skipped++; // duplicate
        } else {
          console.log('  ERROR:', empCode, compName, e.message.substring(0, 100));
        }
      }
    }
  }

  console.log('\nSync complete: Added', added, '| Skipped (dupes)', skipped, '| Not found', notFound);

  // STEP 2: Also update employee.companyId (primary company)
  console.log('\n=== UPDATING PRIMARY COMPANY ===');
  let updated = 0;
  for (const [empCode, companyNames] of Object.entries(mappings)) {
    if (companyNames.length === 0) continue;
    const companyId = resolveCompanyId(companyNames[0]);
    if (!companyId) continue;

    const result = await prisma.employee.updateMany({
      where: { empCode },
      data: { companyId },
    });
    if (result.count > 0) updated++;
  }
  console.log('Updated primary company for', updated, 'employees');

  // STEP 3: Run comparison
  console.log('\n\n========================================');
  console.log('=== EXTENSIVE DATA COMPARISON ===');
  console.log('========================================\n');

  const allEmployees = await prisma.employee.findMany({
    include: {
      department: { select: { name: true } },
      company: { select: { name: true } },
      employeeCompanies: { include: { company: { select: { name: true } } } },
      exitRecord: true,
    },
    orderBy: { empCode: 'asc' },
  });

  // Stats
  const active = allEmployees.filter((e: any) => e.lifecycleStage === 'ACTIVE');
  const exited = allEmployees.filter((e: any) => e.lifecycleStage === 'EXITED');

  console.log('Total Employees:', allEmployees.length);
  console.log('Active:', active.length);
  console.log('Exited:', exited.length);
  console.log('Probation:', allEmployees.filter((e: any) => e.employmentStatus === 'PROBATION' && e.lifecycleStage === 'ACTIVE').length);

  // Check for issues
  const issues: string[] = [];

  // 1. Employees without companies
  const noCompany = allEmployees.filter((e: any) => !e.companyId);
  if (noCompany.length > 0) {
    issues.push('Employees with NO primary company: ' + noCompany.map((e: any) => e.empCode).join(', '));
  }

  // 2. Employees without employee_companies entries
  const noEC = allEmployees.filter((e: any) => e.employeeCompanies.length === 0);
  if (noEC.length > 0) {
    issues.push('Employees with NO bill-to companies: ' + noEC.map((e: any) => e.empCode).join(', '));
  }

  // 3. Exited employees without exit records
  const exitedNoRecord = exited.filter((e: any) => !e.exitRecord);
  if (exitedNoRecord.length > 0) {
    issues.push('Exited employees with NO exit record: ' + exitedNoRecord.map((e: any) => e.empCode).join(', '));
  }

  // 4. Employees without departments
  const noDept = allEmployees.filter((e: any) => !e.departmentId);
  if (noDept.length > 0) {
    issues.push('Employees with NO department: ' + noDept.map((e: any) => e.empCode).join(', '));
  }

  // 5. Employees with placeholder join date
  const placeholderDate = allEmployees.filter((e: any) => {
    const d = new Date(e.dateOfJoining);
    return d.getFullYear() < 2000;
  });
  if (placeholderDate.length > 0) {
    issues.push('Employees with placeholder join date (1970): ' + placeholderDate.map((e: any) => e.empCode).join(', '));
  }

  // 6. Active employees marked as isActive=false
  const activeNotActive = active.filter((e: any) => !e.isActive);
  if (activeNotActive.length > 0) {
    issues.push('ACTIVE lifecycle but isActive=false: ' + activeNotActive.map((e: any) => e.empCode).join(', '));
  }

  // 7. Exited employees still marked isActive=true
  const exitedStillActive = exited.filter((e: any) => e.isActive);
  if (exitedStillActive.length > 0) {
    issues.push('EXITED lifecycle but isActive=true: ' + exitedStillActive.map((e: any) => e.empCode).join(', '));
  }

  // 8. Duplicate emp codes
  const codes = allEmployees.map((e: any) => e.empCode);
  const dupes = codes.filter((c: string, i: number) => codes.indexOf(c) !== i);
  if (dupes.length > 0) {
    issues.push('Duplicate emp codes: ' + dupes.join(', '));
  }

  // 9. Company distribution
  console.log('\n=== COMPANY DISTRIBUTION ===');
  const compDist: Record<string, number> = {};
  allEmployees.forEach((e: any) => {
    const name = e.company?.name || 'NONE';
    compDist[name] = (compDist[name] || 0) + 1;
  });
  Object.entries(compDist).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log('  ' + name + ': ' + count);
  });

  // 10. Department distribution
  console.log('\n=== DEPARTMENT DISTRIBUTION ===');
  const deptDist: Record<string, number> = {};
  allEmployees.forEach((e: any) => {
    const name = e.department?.name || 'NONE';
    deptDist[name] = (deptDist[name] || 0) + 1;
  });
  Object.entries(deptDist).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log('  ' + name + ': ' + count);
  });

  // Print issues
  if (issues.length > 0) {
    console.log('\n=== DISCREPANCIES FOUND ===');
    issues.forEach((issue, i) => console.log((i + 1) + '. ' + issue));
  } else {
    console.log('\n=== NO DISCREPANCIES FOUND ===');
  }

  console.log('\n========================================');
  await prisma.$disconnect();
}

main().catch(console.error);
