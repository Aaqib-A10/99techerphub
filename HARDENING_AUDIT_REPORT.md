# Post-Remediation "Hardening" Audit Report
## 99Tech ERP — Adversarial Stress-Test

**Date:** April 15, 2026
**Auditor Role:** Senior SRE & Lead Security Architect (Chaos Engineering)
**Scope:** Full codebase audit post Phase 1-4 remediation

---

## Hardening Score: 4.5 / 10

The system has meaningful financial plumbing (Decimal migration, advisory locks, tenant extension) but the implementation has critical gaps: the tenant wall has massive holes, transactions run at the wrong isolation level, and a critical race condition can produce duplicate expense numbers.

---

## The "Zero-Day" Risk List

### 1. Duplicate Expense Numbers (Race Condition)
**`app/api/expenses/route.ts:60-83`**

The advisory lock serializes sequence calculation inside a `$transaction`, but the actual `prisma.expense.create()` happens **outside** the transaction. Between lock release and create, another request generates the same number.

```
Thread A: lock → findFirst (seq=4) → calculate seq=5 → COMMIT (lock released)
Thread B: lock → findFirst (seq=4) → calculate seq=5 → COMMIT
Thread A: create expense EXP-2026-04-0005
Thread B: create expense EXP-2026-04-0005  ← DUPLICATE
```

### 2. Tenant Isolation Has 60+ Unprotected Routes
Only **15 of ~80 API routes** use `getSessionContext()`. The rest use `getSessionUser()` with zero company filtering:

- `GET /api/employees` — returns **all employees** from all companies
- `GET /api/employees/[id]` — any employee by ID, no IDOR check
- `GET /api/dashboard/stats` — org-wide financials visible to any role
- `GET /api/audit` — full audit trail of all companies
- `GET /api/export/*` — bulk data export, no tenant filter

An HR user in Company A can enumerate every employee, salary, and expense across all companies.

### 3. All 14 Transactions Default to READ_COMMITTED
No transaction specifies `isolationLevel: 'Serializable'`. For financial operations (salary updates, billing splits, payroll creation), READ_COMMITTED allows phantom reads between concurrent requests. The advisory locks partially compensate, but the salary route can still produce two active salary records for the same employee under load.

---

## Architectural "Leaky Buckets"

### A. Tenant Extension Missing Critical Methods & Models

**Missing Models:**
- `Employee` (has `companyId Int?`) — not in `TENANT_MODELS`
- `Commission`, `Deduction`, `SalaryHistory` — accessible cross-tenant via employee routes

**Missing Methods:**
- `count()` — used by dashboard stats, bypasses all filtering
- `aggregate()` — used by finance reports, bypasses filtering
- `groupBy()` — used by dashboard charts, bypasses filtering

The extension only covers `findMany`/`findFirst`/`findUnique`/`update`/`delete`. Any `prisma.expense.count()` or `prisma.asset.aggregate()` call returns org-wide data.

### B. Raw SQL Bypasses Everything

6 uses of `$queryRaw`/`$executeRaw` in the codebase bypass the tenant extension entirely:
- `app/api/assets/[id]/assign/route.ts:37` — `SELECT * FROM assets FOR UPDATE` with no company check
- `app/api/employees/route.ts:140` — raw INSERT into `employee_companies` with no validation the user can assign to that company
- `app/api/employees/[id]/route.ts:347-349` — raw DELETE/INSERT on `employee_companies`

### C. Hardcoded Secrets in Deployment Script

`DEPLOY-SERVER.sh` contains the production database password in plaintext (`99Tech_ERP_2026!`), a predictable `NEXTAUTH_SECRET` using only a timestamp, and default user passwords (`admin123`, `hr123`, etc.) in seed files committed to git history.

### D. Penny Rounding on Billing Page

`app/finance/billing/page.tsx:122-129` validates percentage splits using `parseFloat()` accumulation with a ±0.01 tolerance — the exact pattern the `validatePercentageSum()` function in `lib/currency.ts` was built to replace. Line 178 performs cost allocation with `Math.round()` after converting Decimal to Number, creating penny-rounding drift across cost centers.

### E. No Automated Tenant Isolation Test

The test suite has 31 unit tests but **none prove Company A cannot see Company B's data**. The tenant tests validate logic patterns in isolation — they don't hit the actual `tenantPrisma()` extension or API routes. There is no integration test that creates two companies, two users, and asserts cross-tenant queries return empty.

---

## Detailed Findings Table

| # | Category | Issue | File & Line | Severity |
|---|----------|-------|-------------|----------|
| 1 | **CONCURRENCY** | Expense create outside transaction | `expenses/route.ts:60-83` | CRITICAL |
| 2 | **TENANT** | 60+ routes use `getSessionUser` not `getSessionContext` | Multiple API routes | CRITICAL |
| 3 | **TENANT** | `Employee` missing from `TENANT_MODELS` | `lib/tenantPrisma.ts` | CRITICAL |
| 4 | **TENANT** | `count()`/`aggregate()`/`groupBy()` not intercepted | `lib/tenantPrisma.ts` | CRITICAL |
| 5 | **TENANT** | Raw SQL bypasses tenant extension | `assets/[id]/assign`, `employees/route` | HIGH |
| 6 | **TRANSACTION** | All txns default to READ_COMMITTED | `salary/route.ts`, `billing/route.ts`, `payroll/[id]/route.ts` | HIGH |
| 7 | **SECRETS** | Hardcoded DB password in DEPLOY-SERVER.sh | `DEPLOY-SERVER.sh:56,114,224` | CRITICAL |
| 8 | **SECRETS** | Weak NEXTAUTH_SECRET (timestamp only) | `DEPLOY-SERVER.sh:117` | HIGH |
| 9 | **SECRETS** | Default passwords in seed files | `seed-users.ts`, `reset-passwords.ts` | HIGH |
| 10 | **PRECISION** | `parseFloat()` in percentage validation | `billing/page.tsx:122-129` | HIGH |
| 11 | **PRECISION** | Unsafe rounding in cost allocation | `billing/page.tsx:178,410` | MEDIUM |
| 12 | **PRECISION** | Float accumulation in notifications | `notificationService.ts:183` | LOW |
| 13 | **AUDIT** | Full objects stored (potential password hash leak) | `schema.prisma:774-788` | MEDIUM |
| 14 | **REFERENTIAL** | Missing CASCADE on Expense.submittedBy | `schema.prisma:581` | MEDIUM |
| 15 | **OFFLINE** | No PWA/service worker | N/A | LOW (design decision) |

---

## Required Fixes (Priority Order)

### P0 — Must Fix Before Multi-Tenant Launch

| Fix | Effort |
|-----|--------|
| Move expense `create()` inside the transaction | 10 min |
| Add `Employee` to `TENANT_MODELS` | 5 min |
| Add `count()`/`aggregate()`/`groupBy()` to tenant extension | 30 min |
| Convert remaining 60+ routes from `getSessionUser` → `getSessionContext` | 3-4 hrs |

### P1 — High Priority

| Fix | Effort |
|-----|--------|
| Add `isolationLevel: 'Serializable'` to financial transactions | 30 min |
| Add integration test proving cross-tenant isolation | 1 hr |
| Remove hardcoded credentials from `DEPLOY-SERVER.sh` | 15 min |
| Add IDOR checks to raw SQL queries | 1 hr |

### P2 — Medium Priority

| Fix | Effort |
|-----|--------|
| Replace `parseFloat()` in billing page with `validatePercentageSum()` | 15 min |
| Sanitize audit log `newValues`/`oldValues` to strip password hashes | 30 min |
| Add `onDelete: Cascade` or `onDelete: SetNull` to orphan-prone relations | 15 min |

---

## Final Production Approval

### Single-Tenant: **CONDITIONAL YES**
The financial hardening (Decimal, transactions, advisory locks) is meaningful, and the race conditions are low-probability in a small team. Fix the expense race condition (P0) before accepting production traffic.

### Multi-Tenant: **NO**
60+ routes leak cross-tenant data. The tenant wall is a screen door — it blocks the 15 routes it covers, but the other 65 walk right through. All P0 items must be resolved before multi-tenant launch.

---

*Generated by adversarial stress-test audit — April 15, 2026*
