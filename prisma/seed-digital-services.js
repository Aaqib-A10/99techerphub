/**
 * Plain-JS version of seed-digital-services.ts so it can run on prod
 * without ts-node. Idempotent — uses upsert keyed by `name`.
 *
 * Run with:
 *   node prisma/seed-digital-services.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SERVICES = [
  {
    name: 'Google Workspace',
    description:
      'Email, Docs, Drive, Calendar, Meet — the core productivity suite for everyone.',
    category: 'Productivity',
    defaultPlan: 'Business Standard',
  },
  {
    name: 'Microsoft 365',
    description:
      'Outlook, Teams, OneDrive, Word/Excel/PowerPoint for Windows-first workflows.',
    category: 'Productivity',
    defaultPlan: 'Business Standard',
  },
  {
    name: 'Slack',
    description:
      'Internal chat + channels. Default for engineering and most office comms.',
    category: 'Communication',
    defaultPlan: 'Pro',
  },
  {
    name: 'GitHub',
    description:
      'Source code, code review, CI. Required for anyone touching the repo.',
    category: 'Development',
    defaultPlan: 'Team',
  },
  {
    name: 'Figma',
    description:
      'Design + prototyping. Add for designers and PMs who review mocks.',
    category: 'Design',
    defaultPlan: 'Professional',
  },
  {
    name: 'Notion',
    description: 'Internal docs, runbooks, project pages, and personal notes.',
    category: 'Productivity',
    defaultPlan: 'Business',
  },
  {
    name: 'Linear',
    description: 'Issue tracking + sprint planning for product + engineering.',
    category: 'Development',
    defaultPlan: 'Standard',
  },
  {
    name: '1Password',
    description:
      'Shared password vaults. Required for anyone with admin access to anything.',
    category: 'Security',
    defaultPlan: 'Business',
  },
  {
    name: 'AWS Console',
    description:
      'Cloud infrastructure. Restricted — request only if you genuinely need it.',
    category: 'Development',
    defaultPlan: 'Org access',
  },
  {
    name: 'VPN',
    description: 'Office network access for remote work and admin tooling.',
    category: 'Security',
    defaultPlan: null,
  },
];

async function main() {
  console.log(`Upserting ${SERVICES.length} digital services…`);
  for (const svc of SERVICES) {
    await prisma.digitalService.upsert({
      where: { name: svc.name },
      update: {
        description: svc.description,
        category: svc.category,
        defaultPlan: svc.defaultPlan,
      },
      create: {
        name: svc.name,
        description: svc.description,
        category: svc.category,
        defaultPlan: svc.defaultPlan,
      },
    });
    console.log(`  ✓ ${svc.name}`);
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
