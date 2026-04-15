const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EXIT_TYPE_MAP: Record<string, string> = {
  'Lay Off': 'TERMINATION',
  'Termination': 'TERMINATION',
  'Resign': 'RESIGNATION',
  'Resignation': 'RESIGNATION',
  'Job Complete': 'CONTRACT_END',
  'Internship Over': 'CONTRACT_END',
  'Intern END': 'CONTRACT_END',
};

async function main() {
  const companies = await prisma.company.findMany();

  function findCompanyId(keyword: string): number | null {
    const lower = keyword.toLowerCase();
    const c = companies.find((co: any) =>
      co.name.toLowerCase().includes(lower) || lower.includes(co.name.toLowerCase())
    );
    return c?.id ?? null;
  }

  // FIX 1: Employees with no bill-to companies
  console.log('=== FIX 1: Employees with no bill-to companies ===');
  const noBillTo = await prisma.employee.findMany({
    where: {
      employeeCompanies: { none: {} },
    },
    select: { id: true, empCode: true, companyId: true, company: { select: { name: true } } },
  });

  for (const emp of noBillTo) {
    if (emp.companyId) {
      // Use primary company
      try {
        await prisma.employeeCompany.create({
          data: { employeeId: emp.id, companyId: emp.companyId },
        });
        console.log('Added from primary:', emp.empCode, '→', emp.company?.name);
      } catch (e: any) {
        if (e.code !== 'P2002') console.log('ERROR:', emp.empCode, e.message.substring(0, 100));
      }
    } else {
      // Assign based on emp code prefix
      const prefix = emp.empCode.split('-')[0];
      let companyName = '';
      if (['SAL', 'CSR', 'DEV'].includes(prefix)) companyName = 'SJ Computers';
      else if (['LRI'].includes(prefix)) companyName = 'LRI';
      else if (['EP'].includes(prefix)) companyName = 'Eternal Perfumes';
      else if (['DM'].includes(prefix)) companyName = 'Minnesota Computers';
      else if (['MB'].includes(prefix)) companyName = '99 Technologies';
      else if (['BSA'].includes(prefix)) companyName = '99 Technologies';
      else companyName = '99 Technologies';

      const cId = findCompanyId(companyName);
      if (cId) {
        await prisma.employee.update({ where: { id: emp.id }, data: { companyId: cId } });
        try {
          await prisma.employeeCompany.create({ data: { employeeId: emp.id, companyId: cId } });
          console.log('Assigned by prefix:', emp.empCode, '→', companyName);
        } catch (e: any) {
          if (e.code !== 'P2002') console.log('ERROR:', emp.empCode, e.message.substring(0, 100));
        }
      }
    }
  }

  // FIX 2: Exited employees without exit records
  console.log('\n=== FIX 2: Exited employees without exit records ===');
  const exitedNoRecord = await prisma.employee.findMany({
    where: {
      lifecycleStage: 'EXITED',
      exitRecord: null,
    },
    select: { id: true, empCode: true, dateOfLeaving: true, exitReason: true },
  });

  let created = 0;
  for (const emp of exitedNoRecord) {
    const exitDate = emp.dateOfLeaving || new Date();
    const exitType = emp.exitReason ? (EXIT_TYPE_MAP[emp.exitReason] || 'RESIGNATION') : 'RESIGNATION';

    try {
      await prisma.employeeExit.create({
        data: {
          employeeId: emp.id,
          exitDate,
          reason: emp.exitReason,
          exitType,
          isComplete: true,
        },
      });
      created++;
      console.log('Created exit record:', emp.empCode, '→', exitType, emp.exitReason || '(no reason)');
    } catch (e: any) {
      if (e.code === 'P2002') {
        console.log('SKIP (exists):', emp.empCode);
      } else {
        console.log('ERROR:', emp.empCode, e.message.substring(0, 100));
      }
    }
  }

  console.log('\nCreated', created, 'exit records');

  // VERIFY
  console.log('\n=== FINAL VERIFICATION ===');
  const stillNoBillTo = await prisma.employee.count({ where: { employeeCompanies: { none: {} } } });
  const stillNoExit = await prisma.employee.count({ where: { lifecycleStage: 'EXITED', exitRecord: null } });
  const total = await prisma.employee.count();
  const active = await prisma.employee.count({ where: { lifecycleStage: 'ACTIVE' } });
  const exited = await prisma.employee.count({ where: { lifecycleStage: 'EXITED' } });

  console.log('Total:', total, '| Active:', active, '| Exited:', exited);
  console.log('Still no bill-to:', stillNoBillTo);
  console.log('Still no exit record:', stillNoExit);

  await prisma.$disconnect();
}

main().catch(console.error);
