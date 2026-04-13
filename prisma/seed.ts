import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.assetTransfer.deleteMany();
  await prisma.assetAssignment.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.assetCategory.deleteMany();
  await prisma.location.deleteMany();
  await prisma.department.deleteMany();
  await prisma.company.deleteMany();

  // Seed Companies
  const companies = await Promise.all([
    prisma.company.create({
      data: {
        code: 'MNC',
        name: 'Minnesota Computers',
        country: 'USA',
        isActive: true,
      },
    }),
    prisma.company.create({
      data: {
        code: 'SJ',
        name: 'SJ Computers',
        country: 'USA',
        isActive: true,
      },
    }),
    prisma.company.create({
      data: {
        code: 'PCMART',
        name: 'PC Mart',
        country: 'USA',
        isActive: true,
      },
    }),
    prisma.company.create({
      data: {
        code: 'RTI',
        name: 'Recycle Technologies',
        country: 'USA',
        isActive: true,
      },
    }),
    prisma.company.create({
      data: {
        code: 'LRI',
        name: 'Lighting Resources Inc',
        country: 'USA',
        isActive: true,
      },
    }),
    prisma.company.create({
      data: {
        code: 'GL',
        name: 'Green Loop',
        country: 'Pakistan',
        isActive: true,
      },
    }),
  ]);

  console.log('Created companies:', companies.length);

  // Seed Departments
  const departments = await Promise.all([
    prisma.department.create({
      data: { name: 'Sales', code: 'SAL', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'Customer Support', code: 'CSR', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'Development', code: 'DEV', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'Marketing', code: 'MKT', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'Admin/HR', code: 'ADM', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'Finance', code: 'FIN', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'ITAD', code: 'ITA', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'E-Commerce', code: 'ECM', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'QA', code: 'QAT', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'Medical Billing', code: 'MED', isActive: true },
    }),
    prisma.department.create({
      data: { name: 'Digital Marketing', code: 'DMK', isActive: true },
    }),
  ]);

  console.log('Created departments:', departments.length);

  // Seed Locations
  const locations = await Promise.all([
    prisma.location.create({
      data: {
        name: 'Eagan Office',
        address: '4950 Victoria Street N, Eagan, MN 55122',
        country: 'USA',
      },
    }),
    prisma.location.create({
      data: {
        name: 'Dubai Office',
        address: 'Dubai, UAE',
        country: 'UAE',
      },
    }),
    prisma.location.create({
      data: {
        name: 'Islamabad HQ Floor 3',
        address: 'Islamabad, Pakistan',
        country: 'Pakistan',
      },
    }),
    prisma.location.create({
      data: {
        name: 'Islamabad HQ Floor 4',
        address: 'Islamabad, Pakistan',
        country: 'Pakistan',
      },
    }),
    prisma.location.create({
      data: {
        name: 'Islamabad HQ Floor 5',
        address: 'Islamabad, Pakistan',
        country: 'Pakistan',
      },
    }),
  ]);

  console.log('Created locations:', locations.length);

  // Seed Asset Categories
  const categories = await Promise.all([
    prisma.assetCategory.create({
      data: {
        name: 'Laptop',
        code: 'LAPTOP',
        description: 'Portable computers',
      },
    }),
    prisma.assetCategory.create({
      data: {
        name: 'Desktop PC',
        code: 'PC',
        description: 'Desktop computers',
      },
    }),
    prisma.assetCategory.create({
      data: {
        name: 'Monitor',
        code: 'MON',
        description: 'Computer monitors',
      },
    }),
    prisma.assetCategory.create({
      data: {
        name: 'Mobile Phone',
        code: 'MOB',
        description: 'Mobile phones and smartphones',
      },
    }),
    prisma.assetCategory.create({
      data: {
        name: 'iPad/Tablet',
        code: 'TAB',
        description: 'Tablets and iPad devices',
      },
    }),
    prisma.assetCategory.create({
      data: {
        name: 'Headset',
        code: 'HEAD',
        description: 'Headphones and headsets',
      },
    }),
    prisma.assetCategory.create({
      data: {
        name: 'Mouse/Keyboard',
        code: 'ACC',
        description: 'Computer accessories',
      },
    }),
    prisma.assetCategory.create({
      data: {
        name: 'Network Equipment',
        code: 'NET',
        description: 'Network devices and routers',
      },
    }),
    prisma.assetCategory.create({
      data: {
        name: 'Furniture',
        code: 'FURN',
        description: 'Office furniture',
      },
    }),
    prisma.assetCategory.create({
      data: {
        name: 'Software License',
        code: 'SW',
        description: 'Software licenses and subscriptions',
      },
    }),
  ]);

  console.log('Created asset categories:', categories.length);

  // Seed Employees
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        empCode: 'EMP001',
        firstName: 'Ahmed',
        lastName: 'Hassan',
        fatherName: 'Hassan Ahmed',
        departmentId: departments[0].id,
        designation: 'Sales Manager',
        employmentStatus: 'PERMANENT',
        dateOfJoining: new Date('2022-01-15'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        empCode: 'EMP002',
        firstName: 'Fatima',
        lastName: 'Khan',
        fatherName: 'Khan Muhammad',
        departmentId: departments[1].id,
        designation: 'Support Specialist',
        employmentStatus: 'PERMANENT',
        dateOfJoining: new Date('2022-06-01'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        empCode: 'EMP003',
        firstName: 'Ali',
        lastName: 'Mirza',
        fatherName: 'Mirza Ahmed',
        departmentId: departments[2].id,
        designation: 'Senior Developer',
        employmentStatus: 'PERMANENT',
        dateOfJoining: new Date('2021-03-10'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        empCode: 'EMP004',
        firstName: 'Sarah',
        lastName: 'Williams',
        fatherName: 'John Williams',
        departmentId: departments[3].id,
        designation: 'Marketing Manager',
        employmentStatus: 'PERMANENT',
        dateOfJoining: new Date('2022-09-01'),
        isActive: true,
      },
    }),
    prisma.employee.create({
      data: {
        empCode: 'EMP005',
        firstName: 'Muhammad',
        lastName: 'Iqbal',
        fatherName: 'Iqbal Hassan',
        departmentId: departments[4].id,
        designation: 'HR Specialist',
        employmentStatus: 'PROBATION',
        dateOfJoining: new Date('2024-01-15'),
        isActive: true,
      },
    }),
  ]);

  console.log('Created employees:', employees.length);

  // Seed Assets
  const assets = await Promise.all([
    prisma.asset.create({
      data: {
        assetTag: '99T-LAPTOP-0001',
        serialNumber: 'SN-DELL-001',
        categoryId: categories[0].id,
        manufacturer: 'Dell',
        model: 'Latitude 5550',
        purchaseDate: new Date('2023-01-15'),
        purchasePrice: 1200,
        currency: 'USD',
        warrantyExpiry: new Date('2025-01-15'),
        condition: 'WORKING',
        companyId: companies[0].id,
        locationId: locations[0].id,
        isAssigned: true,
        isRetired: false,
        notes: 'New laptop for sales team',
      },
    }),
    prisma.asset.create({
      data: {
        assetTag: '99T-LAPTOP-0002',
        serialNumber: 'SN-LENOVO-001',
        categoryId: categories[0].id,
        manufacturer: 'Lenovo',
        model: 'ThinkPad X1 Carbon',
        purchaseDate: new Date('2023-03-20'),
        purchasePrice: 1500,
        currency: 'USD',
        warrantyExpiry: new Date('2025-03-20'),
        condition: 'WORKING',
        companyId: companies[0].id,
        locationId: locations[0].id,
        isAssigned: true,
        isRetired: false,
        notes: 'Developer laptop',
      },
    }),
    prisma.asset.create({
      data: {
        assetTag: '99T-PC-0001',
        serialNumber: 'SN-HP-001',
        categoryId: categories[1].id,
        manufacturer: 'HP',
        model: 'EliteDesk 800 G5',
        purchaseDate: new Date('2022-06-10'),
        purchasePrice: 900,
        currency: 'USD',
        warrantyExpiry: new Date('2024-06-10'),
        condition: 'WORKING',
        companyId: companies[1].id,
        locationId: locations[1].id,
        isAssigned: false,
        isRetired: false,
        notes: 'Desktop for office',
      },
    }),
    prisma.asset.create({
      data: {
        assetTag: '99T-MON-0001',
        serialNumber: 'SN-DELL-MON-001',
        categoryId: categories[2].id,
        manufacturer: 'Dell',
        model: 'UltraSharp 27',
        purchaseDate: new Date('2023-02-01'),
        purchasePrice: 450,
        currency: 'USD',
        warrantyExpiry: new Date('2026-02-01'),
        condition: 'WORKING',
        companyId: companies[0].id,
        locationId: locations[0].id,
        isAssigned: true,
        isRetired: false,
        notes: 'High resolution monitor',
      },
    }),
    prisma.asset.create({
      data: {
        assetTag: '99T-MOB-0001',
        serialNumber: 'SN-IPHONE-001',
        categoryId: categories[3].id,
        manufacturer: 'Apple',
        model: 'iPhone 14 Pro',
        purchaseDate: new Date('2023-10-01'),
        purchasePrice: 999,
        currency: 'USD',
        warrantyExpiry: new Date('2024-10-01'),
        condition: 'WORKING',
        companyId: companies[0].id,
        locationId: locations[0].id,
        isAssigned: true,
        isRetired: false,
        notes: 'Mobile device for manager',
      },
    }),
    prisma.asset.create({
      data: {
        assetTag: '99T-TAB-0001',
        serialNumber: 'SN-IPAD-001',
        categoryId: categories[4].id,
        manufacturer: 'Apple',
        model: 'iPad Pro 12.9',
        purchaseDate: new Date('2023-05-15'),
        purchasePrice: 1200,
        currency: 'USD',
        warrantyExpiry: new Date('2025-05-15'),
        condition: 'WORKING',
        companyId: companies[2].id,
        locationId: locations[2].id,
        isAssigned: false,
        isRetired: false,
        notes: 'Tablet for presentations',
      },
    }),
    prisma.asset.create({
      data: {
        assetTag: '99T-HEAD-0001',
        serialNumber: 'SN-SONY-001',
        categoryId: categories[5].id,
        manufacturer: 'Sony',
        model: 'WH-1000XM5',
        purchaseDate: new Date('2023-08-01'),
        purchasePrice: 400,
        currency: 'USD',
        warrantyExpiry: new Date('2025-08-01'),
        condition: 'WORKING',
        companyId: companies[0].id,
        locationId: locations[0].id,
        isAssigned: true,
        isRetired: false,
        notes: 'Noise cancelling headphones',
      },
    }),
    prisma.asset.create({
      data: {
        assetTag: '99T-ACC-0001',
        serialNumber: 'SN-LOGITECH-001',
        categoryId: categories[6].id,
        manufacturer: 'Logitech',
        model: 'MX Master 3S',
        purchaseDate: new Date('2023-04-01'),
        purchasePrice: 99,
        currency: 'USD',
        warrantyExpiry: new Date('2025-04-01'),
        condition: 'WORKING',
        companyId: companies[0].id,
        locationId: locations[0].id,
        isAssigned: true,
        isRetired: false,
        notes: 'Wireless mouse',
      },
    }),
    prisma.asset.create({
      data: {
        assetTag: '99T-NET-0001',
        serialNumber: 'SN-CISCO-001',
        categoryId: categories[7].id,
        manufacturer: 'Cisco',
        model: 'Catalyst 2960X',
        purchaseDate: new Date('2022-12-01'),
        purchasePrice: 2500,
        currency: 'USD',
        warrantyExpiry: new Date('2025-12-01'),
        condition: 'WORKING',
        companyId: companies[1].id,
        locationId: locations[1].id,
        isAssigned: false,
        isRetired: false,
        notes: 'Network switch',
      },
    }),
    prisma.asset.create({
      data: {
        assetTag: '99T-FURN-0001',
        serialNumber: 'SN-OFFICE-001',
        categoryId: categories[8].id,
        manufacturer: 'Herman Miller',
        model: 'Aeron Chair',
        purchaseDate: new Date('2023-07-01'),
        purchasePrice: 1400,
        currency: 'USD',
        warrantyExpiry: new Date('2028-07-01'),
        condition: 'WORKING',
        companyId: companies[0].id,
        locationId: locations[0].id,
        isAssigned: true,
        isRetired: false,
        notes: 'Ergonomic office chair',
      },
    }),
  ]);

  console.log('Created assets:', assets.length);

  // Create asset assignments
  const assignments = await Promise.all([
    prisma.assetAssignment.create({
      data: {
        assetId: assets[0].id,
        employeeId: employees[0].id,
        assignedById: employees[2].id,
        assignedDate: new Date('2023-01-20'),
        conditionAtAssignment: 'NEW',
        notes: 'Assigned to sales team',
      },
    }),
    prisma.assetAssignment.create({
      data: {
        assetId: assets[1].id,
        employeeId: employees[2].id,
        assignedById: employees[4].id,
        assignedDate: new Date('2023-03-25'),
        conditionAtAssignment: 'NEW',
        notes: 'Development work',
      },
    }),
    prisma.assetAssignment.create({
      data: {
        assetId: assets[3].id,
        employeeId: employees[0].id,
        assignedById: employees[4].id,
        assignedDate: new Date('2023-02-05'),
        conditionAtAssignment: 'NEW',
        notes: 'Monitor for workspace',
      },
    }),
  ]);

  console.log('Created asset assignments:', assignments.length);

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
