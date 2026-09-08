# Database Promotion Strategy

ERS uses different database lifecycle rules for Development, Test, and Production.

## Environment contract

| Environment | Database strategy | Purpose |
|---|---|---|
| Local | Resettable; migration fixtures exercise fresh and historical upgrades | Development and migration verification |
| Development | Replaced from the complete current migration chain on every deployment | Current-state functional integration |
| Test | Preserved and migrated in place on ordinary deployments | Durable release candidate validation |
| Test release rehearsal | Restore a known pre-release baseline, then migrate it in place | Production migration rehearsal |
| Production | Verified backup, then preserved and migrated in place | Execute an upgrade already rehearsed in Test |

Production must never be the first environment in which a historical database upgrade is exercised.

## Local migration verification

`make local-check` runs the deterministic release-migration rehearsal in addition to the backend, frontend, Playwright, and build checks.

For focused migration validation use:

```bash
make migration-check
make migration-rehearsal-check
```

`migration-check` runs the focused Go migration tests. `migration-rehearsal-check` builds a deterministic database at the pre-30I boundary (`000062`), migrates a probe copy through the complete Bite 30I sequence (`000063` through `000066`), and verifies migration history, SQLite integrity, foreign keys, the Application Administrator control-plane permission boundary, the absence of Application Administrator tenant-identity bindings, Support Access Lease schema, and historical audit compatibility.

The Bite 30H migration tests remain responsible for the deliberate Tenant Administrator cardinality rejection cases. Bite 30I.5 does not weaken or replace those checks.

## Development deployment

Development is disposable. Deployment builds the backend image, removes only the Development `backend-data` volume, and uses that exact image to create a fresh SQLite database from every checked-in `.up.sql` migration. Integrity and foreign-key checks must pass before the normal application stack starts.

Development never copies a workstation `app.db` and never carries historical Development test debris across deployments.

After startup, `server-migrated-db-verify` verifies the deployed migration history and final 30I schema/invariants before the deployment continues.

## Ordinary Test deployment

Test is not reset during an ordinary deployment. Before an in-place Test migration, deployment writes a SQLite `.backup` snapshot and requires both `PRAGMA integrity_check` and `PRAGMA foreign_key_check` to pass on that backup. The existing `backend-data` volume then remains in place and the backend entrypoint applies only migrations not already recorded in `schema_migrations`.

After startup, `server-migrated-db-verify` must pass before administrator provisioning, public smoke testing, or deployed Playwright can proceed.

This lets Test behave like Production for in-place upgrades without making Production the first durable-data execution.

The Bite 30H offline Tenant Administrator reconciliation utility is not part of the normal Development or Test deployment path. It remains available for explicit diagnosis/remediation when an intentionally preserved database cannot satisfy migration preconditions; no deployment target invokes it automatically.

## Bite 30I release rehearsal

Bite 30I.5 closes the **Bite 30I workstream**. It is not the final MVP promotion gate; Bites 30J, 30K, and 30L still follow.

A normal branch promotion into `test` is automatically treated as the release rehearsal. The exact source tree promoted from Development is rehearsed against a known pre-30I baseline and must pass deployed Playwright before a Production gate can be recorded.

`workflow_dispatch` remains available for an explicit ordinary Test redeploy with **Test release rehearsal** disabled. When rehearsal is enabled, deployed Playwright must also remain enabled.

The rehearsal baseline is:

```text
/opt/EnterpriseRemoteSystems/test/rehearsal-baselines/pre-bite30i.db
```

The baseline must contain the complete schema through:

```text
000062_tenant_administrator_cardinality.up.sql
```

and must not already contain the first Bite 30I migration:

```text
000063_global_administration_control_plane.up.sql
```

The final migration required for the 30I.5 rehearsal is:

```text
000066_support_access_lease_audit_attribution.up.sql
```

If a captured pre-30I baseline exists, it is reused and never overwritten. If one was not captured before 30I reached Test, `server-test-rehearsal-ensure-baseline` generates a deterministic pre-30I database from repository migrations through `000062`.

The deterministic baseline keeps the valid Bite 30H upper boundary of two distinct Tenant Administrators in the default Tenant. One slot uses the deployed Playwright identity `e2e-default-tenant-admin` / `tenant-admin@example.com`, allowing post-migration provisioning to reconcile that existing identity rather than attempt to create a prohibited third Tenant Administrator. It also contains a pre-30I Application Administrator `people.read` standing permission, a historical ordinary Account attached to an explicitly INACTIVE Membership, and a historical authorization audit row. The probe therefore proves that 30I removes standing Tenant-data authority and that 30I.3 adds support-lease attribution without rewriting historical audit evidence.

Before the baseline is accepted, a copy is migrated through **every** 30I migration:

```text
000063_global_administration_control_plane.up.sql
000064_tenant_driven_person_reactivation.up.sql
000065_tenant_support_access_lease_domain.up.sql
000066_support_access_lease_audit_attribution.up.sql
```

The probe must pass `verify-migrated-db.sh`.

During the actual Test release rehearsal, ERS first takes a verified backup of any existing Test database. The restore step then validates the baseline before replacing the Test SQLite volume. The normal backend startup then performs the real in-place migration from `000062` through `000066` using the same entrypoint used by Production.

After backend health succeeds, deployment runs `server-migrated-db-verify`. The deployment then provisions the deterministic administrative identities, runs public smoke checks, and runs the complete deployed Playwright suite against the migrated database.

Only after all of those checks succeed is a release-rehearsal marker recorded for the deployed **Git source-tree hash**. The marker records the pre-30I boundary, first rehearsed migration, and final 30I migration.

## Capturing a pre-30I Test baseline

A captured pre-30I Test snapshot is preferred when one is available because it preserves a real historical Test state. Capture it only while Test is still at migration `000062` and has not applied `000063`:

```bash
cd /opt/EnterpriseRemoteSystems/test
make server-test-rehearsal-capture-baseline ENV=test
```

The command refuses to overwrite an existing baseline and refuses to capture a database that does not contain `000062` or already contains `000063`.

If the capture target is unavailable on the historical revision, use the existing verified backup path and copy that snapshot before 30I is deployed:

```bash
cd /opt/EnterpriseRemoteSystems/test
make server-test-backup
mkdir -p rehearsal-baselines
cp backups/app-<timestamp>.db rehearsal-baselines/pre-bite30i.db
```

The rehearsal restore validates that copied snapshot before it can replace the Test database. If no snapshot was captured, `make server-test-rehearsal-ensure-baseline ENV=test` generates and validates the deterministic fallback baseline automatically.

## Production release gate

Production deployment computes the immutable Git tree hash for the Production revision and requires a successful Test rehearsal marker for that exact tree. The marker must also prove the expected pre-30I boundary (`000062`), first rehearsed migration (`000063`), and final 30I migration (`000066`).

If Test has not successfully rehearsed the exact source tree and complete 30I migration sequence, Production deployment stops before changing the Production database.

For an accepted Production deployment, ERS creates and validates a SQLite backup of the existing Production database **before** starting the new backend and therefore before any pending migration can run. Backup integrity or foreign-key failure blocks deployment.

After the new backend becomes healthy, `server-migrated-db-verify ENV=production` must pass before the deployment proceeds to the public edge/smoke stages.

This permits branch promotion to use a fast-forward or a merge commit: the commit SHA may differ, but the deployed source tree must be identical to the tree that passed the Test migration rehearsal.
