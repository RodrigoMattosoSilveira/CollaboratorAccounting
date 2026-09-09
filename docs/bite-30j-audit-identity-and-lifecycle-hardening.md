# Bite 30J — Audit Identity and Lifecycle Hardening

## Purpose

Bite 30J makes the Bite 30 identity chain and privilege/lifecycle transitions auditable without removing the compatibility schema reserved for Bite 30K.

For new sensitive audit events, ERS can now preserve the authenticated Authentication Account, effective Actor and scope, acting Person/Membership when applicable, affected Tenant, Authentication Session, per-request correlation identity, permission, authorization source, Tenant Support Access Lease, target, decision, and request evidence.

## Migration boundary

Bite 30J adds:

```text
000067_audit_identity_lifecycle_hardening.up.sql
```

The migration adds nullable audit-identity/source columns and indexes. Historical rows remain unchanged because inferred backfill would manufacture evidence that ERS did not record at the time.

The existing database-level UPDATE/DELETE audit guards remain authoritative. A new INSERT guard requires every post-30J row to carry a correlation identity and requires effective Actor scope whenever a persisted Actor record is attributed.

## Authorization source values

```text
INTRINSIC
ROLE_GRANT
GLOBAL_CONTROL_PLANE
SUPPORT_LEASE
NONE
```

Role-backed sources retain the exact Role Grant ID and Role code. Support-Lease authority retains the exact Lease ID.

## Session and correlation attribution

Authenticated request resolution attaches the internal Authentication Account ID and Session record ID to the effective Actor used by downstream audit writers.

One server-generated correlation ID is reused by audit rows emitted by the same HTTP request and is returned as:

```text
X-Correlation-ID
```

Service-layer audit writers receive this same already-resolved audit context through the request context; they do not reconstruct identity from caller-controlled headers.

## Lifecycle coverage

Bite 30J preserves/extends append-only lifecycle evidence for:

- Authentication Account creation, security suspension and suspension clearing;
- Actor creation/activation/deactivation;
- Role Grant assignment/revocation;
- Person–Tenant Membership creation, status transition and reactivation;
- Collaborator Journey creation and successful closure;
- Tenant Support Access Lease request, approval, use and termination.

The existing Person operational deactivation/reactivation behavior remains unchanged: historical delegated Role Grants stay assigned but lifecycle-suspended, and Tenant reactivation restores only baseline authority until an administrator explicitly re-grants delegated access.

## Tenant support-audit visibility

The existing Tenant Support Access Lease audit endpoint remains Tenant-scoped. 30J enriches the returned evidence rather than widening generic `authz.read` authority for Tenant Administrators.

## Deployment verification

The 30I historical migration rehearsal remains bounded by `000062 → 000066`. The current deployed-schema verifier now expects `000067` and additionally checks the 30J audit columns, indexes, insert guard, and append-only triggers.

The Test release-rehearsal marker records both the completed 30I migration boundary and the current deployment-final migration. Production therefore cannot accept a Test rehearsal for the same source tree that did not verify the 30J schema.

## Deferred to Bite 30K

Bite 30J intentionally does **not** remove legacy compatibility columns/tables or historical projection fields. That destructive cutover remains Bite 30K — Legacy Schema Removal and Migration Hardening.
