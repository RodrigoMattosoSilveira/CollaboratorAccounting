# Bite 30I.5 — Migration Rehearsal and Deployment Hardening

## Purpose

Close the Bite 30I Global Administration Control Plane and Tenant Support Access Lease workstream by proving its historical migrations and deployment path are safe and reproducible.

This bite **does not close the MVP**. Audit identity/lifecycle hardening (30J), legacy schema removal/migration hardening (30K), and final authorization/identity E2E verification (30L) still follow.

## Migration boundary

30I.5 rehearses a database whose last migration is:

```text
000062_tenant_administrator_cardinality.up.sql
```

through:

```text
000063_global_administration_control_plane.up.sql
000064_tenant_driven_person_reactivation.up.sql
000065_tenant_support_access_lease_domain.up.sql
000066_support_access_lease_audit_attribution.up.sql
```

The deterministic fallback baseline is stored as `pre-bite30i.db`.

## Local and CI gate

`make migration-rehearsal-check` creates a temporary pre-30I baseline, migrates a probe copy through all 30I migrations, and runs the migrated-database verifier. `make local-check` includes that rehearsal, and CI runs it as an independent job before Playwright.

The deterministic baseline intentionally contains:

- the valid two-distinct-Person Bite 30H Tenant Administrator upper boundary;
- the deployed `e2e-default-tenant-admin` identity in one of those slots;
- a legacy `APPLICATION_ADMIN -> people.read` standing permission that 000063 must remove;
- an ordinary active Account/Actor/delegated grant whose only Membership is INACTIVE, which 000064 must normalize without erasing grant history;
- a historical authorization audit row that 000066 must preserve with `support_lease_id = NULL`.

## Migrated database verification

`backend/verify-migrated-db.sh` requires:

- exact checked-in migration history through `000066`;
- `PRAGMA integrity_check = ok`;
- clean `PRAGMA foreign_key_check`;
- 30I.1 lifecycle columns from `000064`;
- Tenant Support Access Lease tables from `000065`;
- `authz_audit_logs.support_lease_id` and its index from `000066`;
- exactly the eight standing Application Administrator control-plane/support-lease request/read permissions and no Tenant data-plane permission;
- no active Application Administrator Actor with Person, Collaborator, Tenant Actor, or Account→Person identity bindings;
- preserved historical pre-30I audit evidence when the deterministic rehearsal fixture is present.

## Test release rehearsal

A normal promotion into Test first takes a verified backup of any existing Test database, restores the known pre-30I baseline, and starts the normal backend. The backend entrypoint therefore performs the same in-place migration sequence used in Production.

After backend health succeeds, deployment runs `server-migrated-db-verify`. Administrator provisioning, public smoke checks, and the full deployed Playwright suite occur only after database verification succeeds.

The successful Test release marker records:

- source tree SHA;
- deployed revision;
- baseline path and SHA-256;
- baseline last migration (`000062`);
- first rehearsed migration (`000063`);
- final rehearsed migration (`000066`).

## Preserved database backup hardening

Ordinary Test and Production deployments use in-place migration. Before either preserved database is migrated, deployment invokes `server-backup`.

The backup is accepted only when the copied SQLite snapshot passes:

```text
PRAGMA integrity_check
PRAGMA foreign_key_check
```

The backup path and SHA-256 are emitted in deployment output.

## Production gate

Production requires a successful Test rehearsal marker for the exact Git source-tree hash and the exact 30I migration boundary described above.

After the verified pre-deployment backup, Production starts the new backend, applies pending migrations in place, and must pass `server-migrated-db-verify` before deployment continues.

Production remains excluded from deployed Playwright. Final MVP-wide authorization/identity and deployment verification remains the responsibility of Bite 30L.
