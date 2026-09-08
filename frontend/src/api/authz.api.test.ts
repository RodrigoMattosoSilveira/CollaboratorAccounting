import { describe, expect, it } from "vitest";
import { normalizeAuthzActorList, normalizeAuthzCurrentActor, normalizeSupportAccessLeaseList } from "./authz.api";

describe("normalizeAuthzCurrentActor", () => {
  it("normalizes null authorization collections for a Person-only Actor", () => {
    expect(
      normalizeAuthzCurrentActor({
        actorKey: "manual30d.identity-a@example.test",
        actorRecordId: "actor-a",
        tenantId: "tenant-a",
        scope: "TENANT",
        personId: "person-a",
        globalPersonId: "global-person-a",
        membershipId: "membership-a",
        roleCodes: null,
        permissions: ["authz.self.read", "people.self.read"],
        intrinsicPermissions: ["authz.self.read", "people.self.read"],
        delegatedPermissions: null,
      }),
    ).toEqual({
      actorKey: "manual30d.identity-a@example.test",
      actorRecordId: "actor-a",
      tenantId: "tenant-a",
      scope: "TENANT",
      personId: "person-a",
      globalPersonId: "global-person-a",
      membershipId: "membership-a",
      collaboratorId: undefined,
      roleCodes: [],
      permissions: ["authz.self.read", "people.self.read"],
      intrinsicPermissions: ["authz.self.read", "people.self.read"],
      delegatedPermissions: [],
      supportLeaseId: undefined,
      supportLeaseExpiresAt: undefined,
      supportLeasePermissions: [],
    });
  });

  it("preserves Tenant Support Access Lease provenance for lease-aware UI", () => {
    expect(
      normalizeAuthzCurrentActor({
        actorKey: "bootstrap-admin",
        actorRecordId: "actor-bootstrap-admin",
        tenantId: "default",
        scope: "APPLICATION",
        roleCodes: ["APPLICATION_ADMIN"],
        permissions: ["people.read", "reference_data.read"],
        supportLeaseId: "lease-a",
        supportLeaseExpiresAt: "2026-09-05T18:00:00Z",
        supportLeasePermissions: ["people.read", "reference_data.read"],
      }),
    ).toMatchObject({
      actorKey: "bootstrap-admin",
      actorRecordId: "actor-bootstrap-admin",
      tenantId: "default",
      scope: "APPLICATION",
      supportLeaseId: "lease-a",
      supportLeaseExpiresAt: "2026-09-05T18:00:00Z",
      supportLeasePermissions: ["people.read", "reference_data.read"],
    });
  });

  it("filters malformed collection entries instead of exposing nullable arrays", () => {
    const actor = normalizeAuthzCurrentActor({
      actorKey: "actor-a",
      actorRecordId: "actor-a",
      tenantId: "tenant-a",
      scope: "TENANT",
      roleCodes: ["TENANT_ADMIN", null, 7],
      permissions: null,
      intrinsicPermissions: undefined,
      delegatedPermissions: ["people.read", false],
    });

    expect(actor.roleCodes).toEqual(["TENANT_ADMIN"]);
    expect(actor.permissions).toEqual([]);
    expect(actor.intrinsicPermissions).toEqual([]);
    expect(actor.delegatedPermissions).toEqual(["people.read"]);
  });
});

describe("normalizeAuthzActorList", () => {
  const actor = {
    id: "actor-a",
    actorKey: "person-a@example.test",
    displayName: "Person A",
    active: true,
    roleGrants: [],
  };

  it("preserves the tenant-role actor array returned by the API", () => {
    expect(normalizeAuthzActorList([actor])).toEqual([actor]);
  });

  it("unwraps a nested data array instead of exposing a non-iterable object to React Query consumers", () => {
    expect(normalizeAuthzActorList({ data: [actor] })).toEqual([actor]);
  });

  it("returns an empty array for an unexpected successful response shape", () => {
    expect(normalizeAuthzActorList({ data: { actor } })).toEqual([]);
  });
});

describe("normalizeSupportAccessLeaseList", () => {
  const lease = {
    id: "lease-pending",
    tenantId: "default",
    applicationActorId: "actor-bootstrap-admin",
    requestedByActorId: "actor-bootstrap-admin",
    requestedAt: "2026-09-07T12:00:00Z",
    expiresAt: "2099-09-07T13:00:00Z",
    reason: "Investigate Tenant support incident",
    status: "PENDING",
    effectiveStatus: "PENDING",
    permissions: ["people.read"],
  };

  it("preserves the canonical support lease array", () => {
    expect(normalizeSupportAccessLeaseList([lease])).toEqual([lease]);
  });

  it("unwraps an additional data array instead of exposing a non-iterable object to Lease History", () => {
    expect(normalizeSupportAccessLeaseList({ data: [lease] })).toEqual([lease]);
  });

  it("returns an empty array for an unexpected successful response shape", () => {
    expect(normalizeSupportAccessLeaseList({ data: { lease } })).toEqual([]);
  });
});
