# Bite 30I.3 — Support Access Lease UX and Auditability

## Purpose

Bite 30I.3 exposes the Tenant Support Access Lease lifecycle implemented by Bite 30I.2 through explicit administrator UX and makes support-authorized Tenant activity attributable to the exact lease that supplied the exceptional authority.

## UX

The shared **Administration → Support access** workspace is available to:

- the GLOBAL Application Administrator, who may request a fixed-expiration, permission-scoped lease for exactly one active Tenant and review retained lease history; and
- the current canonical Tenant Administrator for a selected Tenant, who may review that Tenant's requests, approve an unexpired `PENDING` request, terminate an effective `APPROVED` lease immediately, and inspect the lease-specific audit trail.

The request permission catalog is supplied by the backend's canonical Tenant Support Access allowlist. The frontend does not maintain a second security allowlist. Application control-plane permissions and Tenant Administrator authority are never offered as leaseable permissions.

A lease-backed Application Administrator context remains `scope = APPLICATION` for the leased Tenant and cannot use the Support access workspace as a control plane. The top bar displays the active Support Lease ID and expiration on every page rendered under lease-backed authority.

## Auditability

Migration `000066_support_access_lease_audit_attribution` adds `authz_audit_logs.support_lease_id` and an index for lease-history review.

New lease lifecycle audit entries record the Lease ID directly. Historical Bite 30I.2 lifecycle entries are not rewritten; when their first-class column is empty, readers derive the Lease ID from the immutable `target_type = tenant_support_access_lease` and `target_id = <lease ID>` evidence already stored.

When a Tenant request is authorized by a permission contained in `Actor.SupportLeasePermissions`, route authorization emits:

- `operation = support_access.use`;
- the exact `supportLeaseId`;
- Tenant ID;
- effective Actor identity;
- permission code;
- HTTP method/path; and
- `AUTHORIZED` decision.

A permission denial while a lease-backed context is active is retained as a denied support attempt for the same lease. Standing Application permissions are not labeled as successful lease use unless the evaluated permission is actually in the lease permission set.

## Security boundaries

- Lease UX does not create or mutate Person, Membership, Collaborator, Tenant Actor, or Role Grant records.
- Only the GLOBAL Application Administrator may request a lease.
- Only the exact current canonical Tenant Administrator may approve or terminate a lease and review its Tenant-scoped support history.
- Tenant Administrators do not receive general `authz.read` audit access.
- A lapsed `PENDING` request is displayed as expired and cannot be approved.
- Termination affects the next authorization decision immediately; expiration remains derived from the immutable requested expiration.
