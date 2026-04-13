import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import EmployeeExitClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function EmployeeExitPage({
  params,
}: {
  params: { id: string };
}) {
  const employeeId = parseInt(params.id);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: true,
      assetAssignments: {
        where: { returnedDate: null },
        include: {
          asset: { include: { category: true } },
        },
        orderBy: { assignedDate: 'desc' },
      },
      digitalAccess: {
        where: { isActive: true },
        orderBy: { grantedDate: 'desc' },
      },
      exitRecord: true,
    },
  });

  if (!employee) return notFound();

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/employees" className="breadcrumb-item">
          Employees
        </Link>
        <span className="breadcrumb-separator">/</span>
        <Link href={`/employees/${employeeId}`} className="breadcrumb-item">
          {employee.firstName} {employee.lastName}
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item active">Exit Clearance</span>
      </div>

      {/* Header */}
      <PageHero
        eyebrow="People / Lifecycle"
        title="Employee Exit Clearance"
        description={`${employee.firstName} ${employee.lastName} · ${employee.empCode}`}
      />
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-600 mb-1">Employee Name</p>
              <p className="font-semibold text-lg">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="text-xs text-gray-500 mt-2">{employee.empCode}</p>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-600 mb-1">Employee ID</p>
              <p className="font-semibold text-lg">{employee.id}</p>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-600 mb-1">Department</p>
              <p className="font-semibold text-lg">{employee.department.name}</p>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <p className="text-sm text-gray-600 mb-1">Lifecycle Stage</p>
              <p className="font-semibold text-lg">
                {employee.lifecycleStage.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Pipeline */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-heading">Exit Progress</h2>
        </div>
        <div className="flex items-center gap-4">
          {[
            'Initiated',
            'Asset Clearance',
            'Digital Revocation',
            'Finance Settlement',
          ].map((step, idx) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  idx === 0
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {idx + 1}
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center w-16">
                  {step}
                </p>
              </div>
              {idx < 3 && (
                <div className="w-16 h-0.5 bg-gray-300 mx-2 mt-6" />
              )}
            </div>
          ))}
        </div>
      </div>

      <EmployeeExitClient
        employee={employee}
        exitRecord={employee.exitRecord}
        activeAssignments={employee.assetAssignments}
        digitalAccessRecords={employee.digitalAccess}
      />
    </div>
  );
}
