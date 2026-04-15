# FORENSIC AUDIT & RECOVERY ROADMAP
## 99Tech ERP System — Next.js 14 / Prisma / PostgreSQL

**Audit Date:** 2026-04-15
**Auditor:** Staff Systems Engineer — Forensic Data Audit
**System Health Score:** 3/10 — Structurally compromised; some good patterns exist but not applied uniformly

---

# PART I: FORENSIC AUDIT FINDINGS

## THE "NUCLEAR" SUMMARY

**Verdict: This system will not survive its first real multi-user day.**

Your ERP is a **ticking financial time bomb with a polite UI**. It returns `200 OK` while silently corrupting monetary data at the IEEE 754 level. Every single financial field — salaries, expenses, payroll, commissions, deductions, billing splits — is stored as `Float`. This isn't a bug. This is an architectural death sentence. You are running a financial ledger on a data type that cannot represent `0.1` exactly.

The transaction story is split-brain: some critical paths (asset assignment, expense numbering) are properly wrapped in `$transaction` with advisory locks. Others (salary updates, billing splits, payroll finalization) do naked read-then-write sequences that will corrupt under any concurrent load.

**If two HR staff update the same employee's salary simultaneously, one salary record silently disappears.**

---

## CRITICAL FINDING 1: IEEE 754 FLOATING-POINT IN FINANCIAL DATA

**Severity: CRITICAL**

Every financial field in `prisma/schema.prisma` uses `Float` instead of `Decimal`:

| Model | Field | Line |
|-------|-------|------|
| OfferLetter | `salary` | 295 |
| Asset | `purchasePrice` | 469 |
| Expense | `amount` | 564 |
| SalaryHistory | `baseSalary` | 608 |
| SalaryHistory | `incrementPct` | 612 |
| Commission | `amount` | 624 |
| Deduction | `amount` | 639 |
| PayrollRun | `totalGross` | 656 |
| PayrollRun | `totalDeductions` | 657 |
| PayrollRun | `totalNet` | 658 |
| PayrollItem | `baseSalary` | 675 |
| PayrollItem | `commissions` | 676 |
| PayrollItem | `bonuses` | 677 |
| PayrollItem | `deductions` | 678 |
| PayrollItem | `netPay` | 679 |
| BillingSplit | `percentage` | 693 |
| EmployeeExit | `finalSettlement` | 432 |

**The system has a `lib/decimal.ts` helper** with `toMinor()`/`toMajor()`/`safeSum()`/`safeSub()`/`safeAdd()` — but it's **barely used**. Most API routes use raw `parseFloat()` for monetary input.

**Dangerous arithmetic without the helper:**
- `app/api/finance/salary/route.ts:67` — salary increment percentage calculated with raw float division
- `app/api/finance/billing/route.ts:41-43` — percentage sum validation uses `parseFloat()` accumulation
- `app/api/expenses/route.ts:86` — `parseFloat(data.amount)` stored directly
- `app/finance/billing/page.tsx:185` — client-side `salary * split.percentage / 100` without rounding

---

## CRITICAL FINDING 2: NON-ATOMIC FINANCIAL MUTATIONS

**Severity: CRITICAL**

### The "Salary Ghost" — `app/api/finance/salary/route.ts:54-90`

Three sequential, uncommitted operations:
```
Step 1: findFirst(currentSalary)     ← READ (no lock)
Step 2: update(effectiveTo = today)  ← COMMITTED immediately
Step 3: create(newSalary)            ← If this fails, Step 2 already committed
```

**Result if Step 3 fails:** Employee has NO active salary. Payroll calculates zero. `200 OK` on Step 2.

### The "Billing Black Hole" — `app/api/finance/billing/route.ts:53-84`

Three sequential, uncommitted operations:
```
Step 1: findMany(existingSplits)     ← READ (no lock)
Step 2: updateMany(effectiveTo=now)  ← COMMITTED immediately
Step 3: Promise.all(create splits)   ← If any create fails, Step 2 already committed
```

**Result if Step 3 partially fails:** Old splits are closed. Only some new splits exist. Employee is billed at less than 100%.

### The "Half-Paid Payroll" — `app/api/finance/payroll/[id]/route.ts:37-64`

```
Step 1: update(status = 'PAID')      ← COMMITTED immediately
Step 2: findMany(payrollItems)       ← READ
Step 3: for-loop commission updates  ← If any fails, status already says PAID
```

**Result:** Payroll shows PAID. Some commissions never marked as paid. No rollback.

### What's Already Correct (Proof the team knows how):

| Route | Pattern | Grade |
|-------|---------|-------|
| `app/api/assets/[id]/assign/route.ts` | `$transaction` + `SELECT FOR UPDATE` | **A+** |
| `app/api/expenses/route.ts` | `$transaction` + `pg_advisory_xact_lock` | **A+** |
| `app/api/assets/[id]/return/route.ts` | `$transaction` (but no row lock on findFirst) | **B** |

---

## CRITICAL FINDING 3: ZERO TENANT ISOLATION

**Severity: CRITICAL**

There is **no multi-tenant filtering anywhere**. Every query returns all records across all companies.

**Middleware bypass** (`middleware.ts:26`):
```typescript
if (process.env.AUTH_ENFORCE !== '1') {
  return NextResponse.next();  // ALL routes open
}
```

**Dev fallback** (`lib/auth.ts:82`):
```typescript
if (process.env.NODE_ENV === 'development' && process.env.AUTH_ENFORCE !== '1') {
  return prisma.user.findFirst({ where: { role: 'ADMIN' } }); // Returns first admin
}
```

Even with auth enabled, `getSessionUser()` returns the user but **no route checks if the requested resource belongs to that user's company**:

| Endpoint | Tenant Check? |
|----------|--------------|
| `GET /api/expenses` | Returns ALL expenses |
| `GET /api/expenses/[id]` | Returns ANY expense by ID |
| `DELETE /api/expenses/[id]` | Deletes ANY expense by ID |
| `GET /api/finance/salary` | Returns ALL salaries |
| `GET /api/finance/billing` | Returns ALL billing splits |
| `GET /api/assets` | Returns ALL assets |

---

## CRITICAL FINDING 4: IDEMPOTENCY

**Severity: HIGH**

Zero idempotency protection. No duplicate-request detection. Double-clicking "Submit Expense" creates two expenses. Double-clicking "Approve" creates two approval records.

---

## CRITICAL FINDING 5: N+1 QUERY PATTERNS

**Severity: HIGH**

**`app/finance/billing/page.tsx:75-82`** — For each employee, a separate `fetch()` call to get salary:
```typescript
for (const emp of emps) {
  const salRes = await fetch(`/api/finance/salary?employeeId=${emp.id}`);
}
```
200 employees = 200 HTTP requests = timeout.

**`app/api/finance/payroll/[id]/route.ts:44-52`** — For each payroll item, a separate DB query:
```typescript
for (const item of items) {
  await prisma.commission.updateMany({ where: { employeeId: item.employeeId, ... } });
}
```

---

## THE FORENSIC LOG: 5 "Silent Corruption" Scenarios

Each returns `200 OK` while the database is **factually wrong**.

### Scenario 1: "The Phantom Salary"
**File:** `app/api/finance/salary/route.ts:54-78`

Two HR managers open the same employee's salary page. Both see current salary = 50,000. Manager A submits 55,000. Manager B submits 60,000. Both requests read the same `currentSalary` (ID=42), both close it, both create a new salary. Result: Two salary records with `effectiveTo = null`. Payroll picks whichever `findFirst` returns.

### Scenario 2: "The Floating Payroll"
Employee has `baseSalary: 83333.33` (1,000,000/12). In IEEE 754: `83333.33 → 83333.33000000000174...`. Multiply by 200 employees x 12 months. Cumulative drift is real money.

### Scenario 3: "The Half-Paid Payroll"
Admin marks payroll as "PAID". Status updates to PAID. Commission loop fails on employee #47. Employees 1-46 commissions marked paid. Employees 47-200 still unpaid. No rollback.

### Scenario 4: "The Billing Black Hole"
Admin updates billing split (60%/40%). Old splits closed (committed). Only 60% split creates (40% fails). Employee billed at 60% total. Missing 40% is lost revenue.

### Scenario 5: "The Salary Ghost"
Admin creates new salary. Old salary closed (committed). New salary create fails. Employee has no active salary. Payroll calculates zero. Employee doesn't get paid.

---

## SECURITY FINDINGS

| Issue | Location | Severity |
|-------|----------|----------|
| Session cookie `secure: false` | `lib/auth.ts:118` | MEDIUM — session hijackable on HTTP |
| Auth middleware disabled by default | `middleware.ts:26` | HIGH — if `AUTH_ENFORCE` not set, everything is open |
| IDOR on all resource endpoints | All API routes | HIGH — any user can access any record by ID |
| No RBAC enforcement in routes | All API routes | MEDIUM — `getSessionUser()` checks auth but not role |

---

# PART II: PHASE-BASED RECOVERY & HARDENING ROADMAP

---

## IMMEDIATE TRIAGE (First 48 Hours)

### 1. Lock Session Cookie
```typescript
// lib/auth.ts — line 118
secure: process.env.NODE_ENV === 'production',
```

### 2. Enable Auth Enforcement
Set `AUTH_ENFORCE=1` in production `.env`. The dev fallback already checks `NODE_ENV === 'development'`, so production won't use the fallback.

### 3. Disable Direct Delete Without Ownership Check
In `app/api/expenses/[id]/route.ts`, the DELETE handler has no ownership check. Add a guard immediately while the full tenant system is built.

---

## PHASE 1: THE FINANCIAL FOUNDATION (Data Integrity)

### Step 1.1: Migrate Float to Decimal in Prisma Schema

**Strategy:** Prisma's `Decimal` maps to PostgreSQL `NUMERIC`, which stores exact values. The migration is non-destructive — PostgreSQL silently casts `double precision` to `numeric` without data loss.

**Schema changes** (`prisma/schema.prisma`):

```prisma
// BEFORE (every occurrence)
salary    Float
amount    Float
baseSalary Float

// AFTER
salary     Decimal  @db.Decimal(12, 2)
amount     Decimal  @db.Decimal(12, 2)
baseSalary Decimal  @db.Decimal(12, 2)
percentage Decimal  @db.Decimal(5, 2)   // For billing split percentages
```

**Complete field list to migrate:**

| Model | Field | Target Type |
|-------|-------|-------------|
| OfferLetter | salary | `Decimal @db.Decimal(12, 2)` |
| Asset | purchasePrice | `Decimal @db.Decimal(12, 2)` |
| Expense | amount | `Decimal @db.Decimal(12, 2)` |
| SalaryHistory | baseSalary | `Decimal @db.Decimal(12, 2)` |
| SalaryHistory | incrementPct | `Decimal @db.Decimal(5, 2)` |
| Commission | amount | `Decimal @db.Decimal(12, 2)` |
| Deduction | amount | `Decimal @db.Decimal(12, 2)` |
| PayrollRun | totalGross | `Decimal @db.Decimal(14, 2)` |
| PayrollRun | totalDeductions | `Decimal @db.Decimal(14, 2)` |
| PayrollRun | totalNet | `Decimal @db.Decimal(14, 2)` |
| PayrollItem | baseSalary | `Decimal @db.Decimal(12, 2)` |
| PayrollItem | commissions | `Decimal @db.Decimal(12, 2)` |
| PayrollItem | bonuses | `Decimal @db.Decimal(12, 2)` |
| PayrollItem | deductions | `Decimal @db.Decimal(12, 2)` |
| PayrollItem | netPay | `Decimal @db.Decimal(12, 2)` |
| BillingSplit | percentage | `Decimal @db.Decimal(5, 2)` |
| EmployeeExit | finalSettlement | `Decimal? @db.Decimal(12, 2)` |

**Migration execution:**
```bash
# 1. Generate migration (does NOT run it)
npx prisma migrate dev --create-only --name float_to_decimal

# 2. Review the generated SQL — should be ALTER COLUMN TYPE numeric(12,2)
# 3. Apply
npx prisma migrate dev

# 4. On production
npx prisma migrate deploy
```

### Migration Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Data truncation (values > 12 digits) | LOW — PKR salaries are 5-7 digits | Pre-check: `SELECT MAX(amount) FROM expenses` |
| Existing float rounding stored in DB | CERTAIN — but values are already "wrong" at the 15th decimal | Accept: migration preserves existing values; going forward values will be exact |
| Prisma Decimal returns `Prisma.Decimal` objects, not `number` | CERTAIN | Must update all code that does arithmetic (see Step 1.2) |
| Application downtime during ALTER COLUMN | LOW — PostgreSQL ALTER TYPE on small tables is fast | For <100K rows, sub-second. No downtime needed. |
| JSON serialization of Decimal | MEDIUM | Prisma Decimal serializes as string in JSON. Update frontend `parseFloat()` to `Number()` or keep as string for display |

### Step 1.2: Global Currency Utility

Upgrade `lib/decimal.ts` to be the **single point of entry** for all monetary operations:

```typescript
// lib/currency.ts — The ONLY way to handle money in this system

import { Decimal } from '@prisma/client/runtime/library';

const SCALE = 100; // 2 decimal places (paisa/cents)

/**
 * Convert ANY input (Prisma Decimal, string, number, null) to integer minor units.
 * This is the canonical way to prepare a value for arithmetic.
 */
export function toMinor(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  if (value instanceof Decimal) return BigInt(Math.round(value.toNumber() * SCALE));
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0n;
  return BigInt(Math.round(n * SCALE));
}

/**
 * Convert minor units back to a display number (2 decimal places).
 */
export function toMajor(minor: bigint): number {
  return Number(minor) / SCALE;
}

/**
 * Parse user input (form field, JSON body) into a safe storage value.
 * Use this instead of parseFloat() everywhere.
 */
export function parseCurrency(input: unknown): number {
  const minor = toMinor(input);
  return toMajor(minor); // Rounds to exactly 2 decimal places
}

/**
 * Sum an array of monetary values safely.
 */
export function safeSum(values: unknown[]): number {
  const totalMinor = values.reduce<bigint>((acc, v) => acc + toMinor(v), 0n);
  return toMajor(totalMinor);
}

/**
 * Calculate percentage safely: (value * pct) / 100, rounded to 2dp.
 */
export function applyPercentage(value: unknown, percentage: unknown): number {
  const valueMinor = toMinor(value);
  const pctMinor = toMinor(percentage);
  const resultMinor = (valueMinor * pctMinor) / 10000n;
  return toMajor(resultMinor);
}

/**
 * Validate that percentages sum to exactly 100%.
 * Uses integer arithmetic — no floating-point tolerance needed.
 */
export function validatePercentageSum(percentages: unknown[]): boolean {
  const totalMinor = percentages.reduce<bigint>((acc, v) => acc + toMinor(v), 0n);
  return totalMinor === BigInt(100 * SCALE); // 10000n
}
```

**Usage pattern — replace every `parseFloat(data.amount)`:**

```typescript
// BEFORE (app/api/expenses/route.ts:86)
amount: parseFloat(data.amount),

// AFTER
import { parseCurrency } from '@/lib/currency';
amount: parseCurrency(data.amount),
```

**Usage pattern — replace billing percentage validation:**

```typescript
// BEFORE (app/api/finance/billing/route.ts:41-46)
const totalPercentage = splits.reduce(
  (sum: number, split: any) => sum + parseFloat(split.percentage), 0
);
if (Math.abs(totalPercentage - 100) > 0.01) { ... }

// AFTER
import { validatePercentageSum } from '@/lib/currency';
if (!validatePercentageSum(splits.map((s: any) => s.percentage))) {
  return NextResponse.json(
    { error: 'Billing percentages must sum to 100%' },
    { status: 400 }
  );
}
```

---

## PHASE 2: THE IRON WALL (Security & Multi-Tenancy)

### Step 2.1: Prisma Extension for Automatic Tenant Filtering

Create a Prisma Client Extension that **automatically injects `companyId` filters** into every query. This makes it **architecturally impossible** for a developer to write a tenant-leaking query.

```typescript
// lib/prisma-tenant.ts

import { Prisma, PrismaClient } from '@prisma/client';

// Models that have a direct companyId field
const TENANT_MODELS = [
  'asset', 'expense', 'payrollRun', 'billingSplit', 'employeeCompany',
] as const;

/**
 * Returns a Prisma client scoped to a specific company.
 * ALL queries on tenant-aware models automatically filter by companyId.
 *
 * Usage:
 *   const ctx = await getSessionContext();
 *   const db = getTenantClient(ctx.companyIds);
 *   const expenses = await db.expense.findMany(); // auto-filtered
 */
export function getTenantClient(companyIds: number[]) {
  const basePrisma = new PrismaClient();

  return basePrisma.$extends({
    query: {
      expense: {
        async findMany({ args, query }) {
          args.where = { ...args.where, companyId: { in: companyIds } };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, companyId: { in: companyIds } };
          return query(args);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && !companyIds.includes(result.companyId)) return null;
          return result;
        },
        async update({ args, query }) {
          const existing = await basePrisma.expense.findUnique({
            where: args.where, select: { companyId: true },
          });
          if (!existing || !companyIds.includes(existing.companyId)) {
            throw new Error('TENANT_VIOLATION: Record does not belong to your company');
          }
          return query(args);
        },
        async delete({ args, query }) {
          const existing = await basePrisma.expense.findUnique({
            where: args.where, select: { companyId: true },
          });
          if (!existing || !companyIds.includes(existing.companyId)) {
            throw new Error('TENANT_VIOLATION: Record does not belong to your company');
          }
          return query(args);
        },
      },
      // Repeat pattern for: asset, payrollRun, billingSplit, employee
      // In practice, generate this with a helper function for each model
    },
  });
}
```

### Step 2.2: Refactor getSessionUser to Return Company Context

```typescript
// lib/auth.ts — Enhanced return type

export interface SessionContext {
  user: User & { role: UserRole };
  companyId: number | null;      // User's primary company
  companyIds: number[];          // All companies user has access to
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const employee = user.employeeId
    ? await prisma.employee.findUnique({
        where: { id: user.employeeId },
        select: {
          companyId: true,
          employeeCompanies: { select: { companyId: true } },
        },
      })
    : null;

  const primaryCompanyId = employee?.companyId ?? null;
  const companyIds = employee?.employeeCompanies?.map(ec => ec.companyId) ?? [];

  // Admins may see all companies
  if (user.role === 'ADMIN') {
    const allCompanies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return {
      user,
      companyId: primaryCompanyId,
      companyIds: allCompanies.map(c => c.id),
    };
  }

  return { user, companyId: primaryCompanyId, companyIds };
}
```

### Step 2.3: IDOR Protection Pattern

Every API route that returns a resource by ID must verify ownership:

```typescript
// PATTERN: Every GET /api/[resource]/[id] route

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expense = await prisma.expense.findUnique({
    where: { id: parseInt(params.id) },
  });

  if (!expense) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // IDOR CHECK
  if (!ctx.companyIds.includes(expense.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(expense);
}
```

---

## PHASE 3: THE ATOMIC SHIELD (Concurrency & Transactions)

### Step 3.1: Fix "The Salary Ghost"

Wrap the entire salary update in a `$transaction` with an advisory lock:

```typescript
// app/api/finance/salary/route.ts — FIXED POST handler

export async function POST(request: NextRequest) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await request.json();
  const employeeId = parseInt(data.employeeId);

  const salary = await prisma.$transaction(async (tx) => {
    // Advisory lock per employee — prevents concurrent salary updates
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(99002, ${employeeId})`;

    const currentSalary = await tx.salaryHistory.findFirst({
      where: { employeeId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (currentSalary) {
      await tx.salaryHistory.update({
        where: { id: currentSalary.id },
        data: { effectiveTo: new Date(data.effectiveFrom) },
      });
    }

    const incrementPct = currentSalary
      ? ((parseCurrency(data.baseSalary) - Number(currentSalary.baseSalary))
          / Number(currentSalary.baseSalary)) * 100
      : null;

    const newSalary = await tx.salaryHistory.create({
      data: {
        employeeId,
        baseSalary: parseCurrency(data.baseSalary),
        currency: data.currency || 'PKR',
        effectiveFrom: new Date(data.effectiveFrom),
        incrementPct: incrementPct
          ? Math.round(incrementPct * 100) / 100
          : null,
        reason: data.reason || null,
      },
    });

    await tx.auditLog.create({
      data: {
        tableName: 'salary_history',
        recordId: newSalary.id,
        action: 'CREATE',
        module: 'FINANCE',
        newValues: newSalary as any,
        oldValues: currentSalary as any,
      },
    });

    return newSalary;
  });

  return NextResponse.json(salary, { status: 201 });
}
```

### Step 3.2: Fix "The Billing Black Hole"

```typescript
// app/api/finance/billing/route.ts — FIXED POST handler

export async function POST(request: NextRequest) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await request.json();
  const { employeeId, splits } = data;

  if (!validatePercentageSum(splits.map((s: any) => s.percentage))) {
    return NextResponse.json(
      { error: 'Billing percentages must sum to 100%' },
      { status: 400 }
    );
  }

  const newSplits = await prisma.$transaction(async (tx) => {
    // Advisory lock per employee
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(
      99003, ${parseInt(employeeId)}
    )`;

    const existingSplits = await tx.billingSplit.findMany({
      where: { employeeId: parseInt(employeeId), effectiveTo: null },
    });

    if (existingSplits.length > 0) {
      await tx.billingSplit.updateMany({
        where: { employeeId: parseInt(employeeId), effectiveTo: null },
        data: { effectiveTo: new Date() },
      });
    }

    const created = [];
    for (const split of splits) {
      const newSplit = await tx.billingSplit.create({
        data: {
          employeeId: parseInt(employeeId),
          companyId: parseInt(split.companyId),
          percentage: parseCurrency(split.percentage),
          effectiveFrom: new Date(),
        },
        include: { employee: true, company: true },
      });
      created.push(newSplit);
    }

    await tx.auditLog.create({
      data: {
        tableName: 'billing_splits',
        recordId: created[0]?.id || 0,
        action: 'CREATE',
        module: 'FINANCE',
        newValues: { splits: created },
        oldValues: { splits: existingSplits },
      },
    });

    return created;
  });

  return NextResponse.json(newSplits, { status: 201 });
}
```

### Step 3.3: Fix "The Half-Paid Payroll"

```typescript
// app/api/finance/payroll/[id]/route.ts — FIXED mark_paid action

if (data.action === 'mark_paid') {
  const result = await prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.update({
      where: { id: runId },
      data: { status: 'PAID', paidAt: new Date() },
    });

    // Batch update instead of N+1 loop
    const items = await tx.payrollItem.findMany({
      where: { payrollRunId: runId },
      select: { employeeId: true },
    });
    const employeeIds = items.map(i => i.employeeId);

    // Single query replaces N individual updates
    await tx.commission.updateMany({
      where: {
        employeeId: { in: employeeIds },
        period: run.period,
        isPaid: false,
      },
      data: { isPaid: true },
    });

    await tx.auditLog.create({
      data: {
        tableName: 'payroll_runs',
        recordId: runId,
        action: 'UPDATE',
        module: 'PAYROLL',
        newValues: {
          status: 'PAID',
          employeesAffected: employeeIds.length,
        },
      },
    });

    return run;
  });

  return NextResponse.json(result);
}
```

### Step 3.4: Idempotency Layer

Add a `RequestLog` table to prevent duplicate submissions:

```prisma
// prisma/schema.prisma — Add this model

model RequestLog {
  id             Int      @id @default(autoincrement())
  idempotencyKey String   @unique
  method         String   // POST, PATCH, DELETE
  path           String
  statusCode     Int
  responseBody   Json?
  createdAt      DateTime @default(now())

  @@index([idempotencyKey])
  @@map("request_logs")
}
```

```typescript
// lib/idempotency.ts

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Check if this request was already processed.
 * Returns cached response if so, null otherwise.
 */
export async function checkIdempotency(
  key: string | null
): Promise<NextResponse | null> {
  if (!key) return null;

  const existing = await prisma.requestLog.findUnique({
    where: { idempotencyKey: key },
  });

  if (existing) {
    return NextResponse.json(
      existing.responseBody,
      { status: existing.statusCode }
    );
  }

  return null;
}

/**
 * Save the response for future duplicate detection.
 */
export async function saveIdempotency(
  key: string | null,
  method: string,
  path: string,
  statusCode: number,
  responseBody: any
): Promise<void> {
  if (!key) return;
  await prisma.requestLog.create({
    data: {
      idempotencyKey: key,
      method,
      path,
      statusCode,
      responseBody,
    },
  }).catch(() => {}); // Ignore duplicate key on race
}
```

**Frontend integration — add idempotency key to mutation requests:**

```typescript
// lib/api.ts

import { v4 as uuidv4 } from 'uuid';

export async function apiPost(path: string, body: any) {
  const key = uuidv4();
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': key,
    },
    body: JSON.stringify(body),
  });
}
```

**API route usage:**

```typescript
export async function POST(request: NextRequest) {
  const key = request.headers.get('X-Idempotency-Key');
  const cached = await checkIdempotency(key);
  if (cached) return cached;

  // ... do work ...

  await saveIdempotency(key, 'POST', '/api/expenses', 201, expense);
  return NextResponse.json(expense, { status: 201 });
}
```

---

## PHASE 4: OPTIMIZATION (Solving the N+1 Crisis)

### Step 4.1: Fix Billing Page N+1

Replace 200 sequential fetch calls with a single batch query:

```typescript
// BEFORE: app/finance/billing/page.tsx (lines 75-82)
for (const emp of emps) {
  const salRes = await fetch(
    `/api/finance/salary?employeeId=${emp.id}`
  );
}
// 200 employees = 200 HTTP round-trips

// AFTER: Add batch endpoint
// app/api/finance/salary/batch/route.ts

export async function GET(request: NextRequest) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const salaries = await prisma.salaryHistory.findMany({
    where: { effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });

  // Convert to map for O(1) lookup by employeeId
  const salaryMap: Record<number, typeof salaries[0]> = {};
  for (const sal of salaries) {
    if (!salaryMap[sal.employeeId]) {
      salaryMap[sal.employeeId] = sal;
    }
  }

  return NextResponse.json(salaryMap);
}
```

**Billing page update:**

```typescript
// AFTER: Single fetch replaces 200 fetches
const salRes = await fetch('/api/finance/salary/batch');
const salaryMap = await salRes.json();
// Now salaryMap[emp.id] gives the salary directly
```

### Step 4.2: Fix Payroll Commission N+1

Already solved in Step 3.3 — the `for` loop is replaced with a single `updateMany` using `{ in: employeeIds }`.

---

## VALIDATION: THE HARDENING SUITE

### Five Pre-Flight Integration Tests

These tests must pass in CI before any release touches financial data. Each tests the **"Failure at Step 2 of 3"** scenario.

```typescript
// __tests__/integration/financial-integrity.test.ts

describe('Financial Integrity — Atomic Operations', () => {

  test('1. Salary update is atomic — partial failure rolls back',
    async () => {
    // Setup: Employee with salary = 50,000
    // Mock: prisma.salaryHistory.create throws AFTER update
    // Assert: Old salary still has effectiveTo = null
    // Assert: No new salary record exists
    // Assert: Payroll would calculate 50,000
  });

  test('2. Billing split update is atomic — partial create rolls back',
    async () => {
    // Setup: Employee with 100% Company A split
    // Mock: Second split create (40% Company B) throws
    // Assert: Original 100% split still active (effectiveTo = null)
    // Assert: No partial splits exist
  });

  test('3. Payroll mark_paid is atomic — commission failure rolls back',
    async () => {
    // Setup: Payroll run with 5 employees, each with commissions
    // Mock: commission.updateMany throws
    // Assert: PayrollRun.status is still FINALIZED
    // Assert: All commissions still isPaid = false
  });

  test('4. Concurrent salary updates are serialized', async () => {
    // Setup: Employee with salary = 50,000
    // Action: Two concurrent POST requests (55,000 and 60,000)
    // Assert: Exactly ONE new salary exists
    // Assert: Exactly ONE old salary was closed
    // Assert: Only one effectiveTo=null record exists
  });

  test('5. Tenant isolation prevents cross-company access', async () => {
    // Setup: User A (Company 1), User B (Company 2),
    //        Expense E1 (Company 1)
    // Action: User B GETs /api/expenses/[E1.id]
    // Assert: Response is 403, not 200
    // Action: User B GETs /api/expenses (list)
    // Assert: Response contains zero Company 1 expenses
  });

});
```

### CI/CD Integration Strategy

```yaml
# .github/workflows/financial-integrity.yml

name: Financial Integrity Gate
on:
  pull_request:
    paths:
      - 'app/api/finance/**'
      - 'app/api/expenses/**'
      - 'app/api/assets/**'
      - 'prisma/schema.prisma'
      - 'lib/currency.ts'
      - 'lib/decimal.ts'

jobs:
  integrity-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_erp
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_erp
      - run: npm test -- --testPathPattern=financial-integrity
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_erp
```

---

## IMPLEMENTATION PRIORITY & TIMELINE

| Priority | Phase | Task | Risk if Skipped |
|----------|-------|------|----------------|
| **P0** | Triage | Set `secure: true` on session cookie | Session hijack |
| **P0** | Triage | Set `AUTH_ENFORCE=1` in production | Unauthenticated access |
| **P1** | Phase 1 | Migrate Float to Decimal | Cumulative financial drift |
| **P1** | Phase 1 | Replace all `parseFloat()` with `parseCurrency()` | Precision errors on input |
| **P1** | Phase 3 | Wrap salary/billing/payroll in `$transaction` | Silent data corruption |
| **P2** | Phase 2 | Add tenant isolation (IDOR checks) | Cross-company data leaks |
| **P2** | Phase 3 | Add idempotency layer | Duplicate records on retry |
| **P3** | Phase 4 | Fix N+1 queries | Timeout on billing page |
| **P3** | Phase 2 | Prisma Extension for auto-filtering | Developer error risk |
| **P4** | Validation | CI integration tests | Regression risk |

---

## DEFINITION OF DONE: Health Score 0/10 to 9/10

| Criterion | Current | Target | Verification |
|-----------|---------|--------|-------------|
| Financial precision | Float (IEEE 754) | Decimal (exact) | `SELECT pg_typeof(amount) FROM expenses LIMIT 1` returns `numeric` |
| Monetary input parsing | Raw `parseFloat()` | `parseCurrency()` everywhere | `grep -r "parseFloat" app/api/finance/` returns zero hits |
| Transaction atomicity | 3 of 6 critical paths | 6 of 6 critical paths | All 5 hardening tests pass |
| Tenant isolation | None | Every query filtered by companyId | Test 5 passes |
| Idempotency | None | All POST/PATCH endpoints | Duplicate requests return cached response |
| Session security | `secure: false` | `secure: true` in production | Cookie shows `Secure` flag |
| Auth enforcement | Opt-in (`AUTH_ENFORCE`) | Always-on in production | Middleware blocks unauthenticated requests |
| N+1 queries | 2 critical paths | 0 N+1 patterns | Billing page loads <2s with 200 employees |
| CI gating | None | Financial integrity tests block merge | GitHub Actions checks pass |

---

## WHAT KEEPS THIS AT 9/10 INSTEAD OF 10/10

The remaining 1 point requires:
- **Row-Level Security (RLS) in PostgreSQL** as defense-in-depth behind Prisma
- **Database-level audit triggers** instead of application-level audit logs
- **Encrypted-at-rest salary/banking fields** (not just transport encryption)

These are Phase 5+ improvements requiring significant infrastructure changes.

---

*This document is a living specification. Each phase completion should be followed by a re-audit of the affected components.*
