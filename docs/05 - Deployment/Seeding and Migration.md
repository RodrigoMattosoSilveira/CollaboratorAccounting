# Seeding and Migration

ERS database promotion separates disposable environment seeding from durable in-place migration.

- Development is rebuilt from the complete migration chain on deployment.
- Ordinary Test deployments preserve the Test database, take a verified backup, and migrate it in place.
- Production deployments preserve the Production database, require an exact-tree Test release-rehearsal gate, take a verified backup, and migrate it in place.
- A Test release rehearsal explicitly restores a known pre-release baseline, then exercises the same in-place migration path used by Production.

## Bite 30I release rehearsal

Bite 30I.5 moves the release baseline to the **pre-30I boundary**:

```text
baseline: 000062_tenant_administrator_cardinality.up.sql
first rehearsed migration: 000063_global_administration_control_plane.up.sql
final rehearsed migration: 000066_support_access_lease_audit_attribution.up.sql
```

A push to the `test` branch is a release promotion, so deployment automatically runs the Test release rehearsal rather than treating the accumulated Test database as the release baseline. The rehearsal restores `/opt/EnterpriseRemoteSystems/test/rehearsal-baselines/pre-bite30i.db`, migrates it in place through the complete 30I sequence, verifies the migrated database, and runs deployed Playwright.

If the baseline does not exist, `server-test-rehearsal-ensure-baseline` builds a deterministic pre-30I baseline from repository migrations through `000062` and probes it through `000066` before accepting it. An existing captured baseline is never overwritten. Manual `workflow_dispatch` may still request an ordinary Test redeploy with release rehearsal disabled.

`server-migrated-db-verify` validates the checked-in migration history, SQLite integrity, foreign keys, final 30I schema, Application Administrator control-plane-only standing authority, and the Application Administrator tenant-identity invariant after startup.

Bite 30I.5 closes Bite 30I only. The final MVP authorization/identity promotion gate remains Bite 30L after Bites 30J and 30K.
