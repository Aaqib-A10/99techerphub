import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEAM_MAP: Record<string, string> = {
  'SAL-101': 'SJ Sales Team',
  'SAL-104': 'SJ Sales Team',
  'SAL-108': 'SJ Sales Team',
  'SAL-112': 'SJ Sales Team',
  'SAL-116': 'SJ Sales Team',
  'SAL-117': 'SJ Sales Team',
  'SAL-118': 'SJ Sales Team',
  'SAL-119': 'SJ Sales Team',
  'CSR-126': 'SJ Customer Support Team',
  'CSR-127': 'SJ Customer Support Team',
  'EP-128': 'Eternal Perfumes',
  'CSR-129': 'SJ Customer Support Team',
  'CSR-130': 'SJ Customer Support Team',
  'CSR-131': 'SJ Customer Support Team',
  'CSR-132': 'SJ Customer Support Team',
  'CSR-133': 'SJ Customer Support Team',
  'PCM-136': 'PC Mart',
  'DEV-139': 'Shipnest',
  'DEV-140': 'Brain Box',
  'DEV-143': 'UI/UX',
  'DEV-144': 'Stockwise/Shipnest',
  'DEV-145': 'Stockwise',
  'DEV-146': 'Stockwise',
  'DEV-149': 'SecureWipe(ITAD)',
  'DEV-151': 'Shipnest',
  '155': 'MNC Back Office',
  'DEV-156': 'Greenloop',
  'DEV-157': 'Greenloop',
  'DEV-158': 'Greenloop',
  'DEV-159': 'Greenloop',
  'DEV-160': 'Greenloop',
  'DEV-161': 'Greenloop',
  'UT-168': 'Wordpress',
  'UT-169': 'Wordpress',
  'RTI-170': 'RTI - Back Office',
  'RTI-171': 'RTI-Billing',
  'LRI-173': 'LRI - Back Office',
  'LRI-174': 'LRI - Back Office',
  'DEV-179': 'Stockwise',
  'LRI-182': 'NetSuite',
  'LRI-183': 'NetSuite',
  'EP-191': 'Eternal Perfumes',
  'LRI-195': 'Billing',
  '197': '99 Tech',
  '198': '99 Tech',
  '199': '99 Tech',
  '200': '99 Tech',
  '201': '99 Tech',
  'DEV-206': 'Acountwise',
  'DEV-207': 'Accountwise',
  'DEV-208': 'Accountwise',
  'DEV-210': 'VOIP/LMS',
  'SAL-214': 'SJ Sales Team',
  'DEV-216': 'Stockwise',
  'DEV-217': 'CTO',
  'DEV-221': 'SecureWipe(ITAD)',
  'EP-222': 'Eternal Perfumes',
  'UT-226': 'Medical Billing',
  'DEV-228': 'Accountwise',
  'LRI-230': 'Billing',
  'EP-231': 'Eternal Perfumes',
  'DEV-234': 'Accountwise',
  'EP-237': 'Eternal Perfumes',
  'DEV-248': 'Shipnest',
  'EP-250': 'Eternal Perfumes',
  'DEV-255': 'Accountwise',
  'DEV-256': 'Greenloop',
  'DEV-265': 'Shipnest',
  'UT-266': 'VoIP + SMS',
  'CSR-268': 'E Commerce',
  'DEV-269': 'Greenloop',
  'DEV-270': 'Brainbox',
  'CSR-271': 'SJ Customer Support Team',
  'EP-272': 'Eternal Perfumes',
  'EP-273': 'Eternal Perfumes',
  'CSR-276': 'SJ Customer Support Team',
  'DEV-277': 'Product',
  'DEV-279': 'Stockwise',
  'EP-281': 'Eternal Perfumes',
  'DEV-282': 'Shipnest',
  'LRI-284': 'Shipping',
  'EP-285': 'Eternal Perfumes',
  'EP-286': 'Eternal Perfumes',
  'EP-287': 'Eternal Perfumes',
  'DEV-288': 'Ezi on the Earth',
  'EP-289': 'Eternal Perfumes',
  'DEV-290': 'Secure Wipe',
  'EP-UK-291': 'Eternal Perfumes',
  'CSR-293': 'SJ Customer Support Team',
  'DEV-294': 'Intern',
  'DEV-298': 'Account Wise',
  'EP-299': 'Eternal Perfumes',
  'CSR-300': 'SJ Customer Support Team',
  'DEV-301': 'Ezi on the Earth',
  'DEV-302': 'AI transcription',
  'EP-303': 'Eternal Perfumes',
  'DEV-304': 'Secure Wipe',
  'EP-305': 'Eternal Perfumes',
  'CSR-306': 'E Commerce',
  'DEV-307': 'BrainBox/ Talkloop-VOIP',
  'CSR-308': 'SJ Customer Support Team',
  'DEV-310': 'Compliance, Cyber Security',
  'CSR-311': 'SJ Customer Support Team',
  'EP-312': 'Eternal Perfumes',
  'EP-313': 'Eternal Perfumes',
  'UT-314': 'Talkloop VOIP',
  'UT-316': 'Talkloop VOIP',
  'UT-317': 'Ebay Listing App',
  'DEV-319': 'Stockwise, Shipnest',
  'CSR-320': 'E Commerce',
  'CSR-321': 'SJ Customer Support Team',
  'CSR-322': 'SJ Customer Support Team',
  'CSR-324': 'E Commerce',
  'DEV-325': 'AWS Architect',
  'EP-326': 'Eternal Perfumes',
  'CSR-327': 'E Commerce',
  'DEV-328': 'ITAD',
  'DEV-330': 'Innovation Centre',
  'EP-331': 'Eternal Perfumes',
  'CSR-332': 'E Commerce',
  'DEV-333': 'Shipnest',
  'DEV-334': 'Stockwise',
  'EP-341': 'Eternal Perfumes',
  'UT-342': 'VOIP/LMS',
  'ITAD-347': 'ITAD',
  'EP-348': 'Eternal Perfumes',
  'ITAD-349': 'ITAD',
  'CSR-351': 'E Commerce',
  'ITAD-353': 'ITAD',
  'DEV-354': 'Ezi on the Earth',
  'DEV-356': 'Ezi on the Earth',
  'DEV-357': 'Stockwise',
  'EP-359': 'Eternal Perfumes',
  'DEV-360': 'Intern',
  'DEV-361': 'Brain Box',
  'DEV-362': 'Product, Business Analyst',
  'DR-364': 'Decomrobotics',
  'DR-365': 'Decomrobotics',
  'DEV-366': 'INTERN',
  'CSR-367': 'SJ Customer Support Team',
  'DR-368': 'Decomrobotics',
  'DEV-369': 'Ezi on the Earth',
  'DEV-370': 'Ezi on the Earth',
  'DEV-371': 'INTERN',
  'EP-372': 'Eternal Perfumes',
  'DR-374': 'Decomrobotics',
  'DR-375': 'Decomrobotics',
  'DM-376': 'Social Media Manager',
  'ITAD-377': 'ITAD',
  'DEV-378': 'Stockwise',
  'CSR-379': 'E Commerce',
  'ITAD-380': 'ITAD',
  'ITAD-381': 'ITAD',
};

async function main() {
  console.log(`Loaded ${Object.keys(TEAM_MAP).length} team mappings`);

  const employees = await prisma.employee.findMany({
    select: { id: true, empCode: true, team: true },
  });

  console.log(`Total employees in DB: ${employees.length}`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const emp of employees) {
    const newTeam = TEAM_MAP[emp.empCode];
    if (!newTeam) {
      notFound++;
      continue;
    }

    if (emp.team === newTeam) {
      skipped++;
      continue;
    }

    await prisma.employee.update({
      where: { id: emp.id },
      data: { team: newTeam },
    });

    console.log(`  ${emp.empCode}: "${emp.team || '(empty)'}" -> "${newTeam}"`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Already correct: ${skipped}, Not in spreadsheet: ${notFound}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
