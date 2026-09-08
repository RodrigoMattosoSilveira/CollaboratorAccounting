import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import {
  E2E_APPLICATION_ADMIN_ACTOR_ID,
  applicationAdminHeaders,
  authzHeaders,
  e2eApiUrl,
  newApplicationAdminApi,
  newTenantAdminApi,
} from "./support/authz";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
};

type CurrentActor = {
  actorKey: string;
  actorRecordId: string;
  tenantId: string;
  scope: string;
  personId?: string;
  globalPersonId?: string;
  membershipId?: string;
  collaboratorId?: string;
  roleCodes: string[];
  permissions: string[];
  delegatedPermissions: string[];
  intrinsicPermissions: string[];
  supportLeaseId?: string;
  supportLeaseExpiresAt?: string;
  supportLeasePermissions?: string[];
};

type SupportAccessLease = {
  id: string;
  tenantId: string;
  applicationActorId: string;
  requestedByActorId: string;
  requestedAt: string;
  expiresAt: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "TERMINATED";
  effectiveStatus: "PENDING" | "APPROVED" | "TERMINATED" | "EXPIRED";
  permissions: string[];
  approvedAt?: string;
  approvedByActorId?: string;
  terminatedAt?: string;
  terminatedByActorId?: string;
  terminationReason?: string;
};

type Permission = {
  code: string;
  label: string;
  description: string;
};

type AuditLog = {
  id: string;
  actorId?: string;
  actorRecordId?: string;
  tenantId?: string;
  permissionCode?: string;
  supportLeaseId?: string;
  operation: string;
  targetType?: string;
  targetId?: string;
  decision: string;
  requestMethod?: string;
  requestPath?: string;
};

const SUPPORT_TENANT_ID = "e2e-support-lease-tenant";
const OTHER_TENANT_ID = "e2e-support-lease-other-tenant";
const EXPIRED_TENANT_ID = "e2e-support-lease-expired-tenant";
const EXPIRED_PENDING_LEASE_ID = "e2e-support-lease-expired-pending";

test.describe("Tenant Support Access Lease authorization", () => {
  test("deterministic fixtures expose the global Application Administrator, exact-Tenant Administrator, and expired PENDING status", async () => {
    const applicationAdminApi = await newApplicationAdminApi();
    const tenantAdminApi = await newTenantAdminApi(SUPPORT_TENANT_ID);
    try {
      const applicationActor = await getCurrentActor(
        applicationAdminApi,
        applicationTenantHeaders("*"),
      );
      expect(applicationActor.actorKey).toBe(E2E_APPLICATION_ADMIN_ACTOR_ID);
      expect(applicationActor.scope).toBe("APPLICATION");
      expect(applicationActor.tenantId).toBe("*");
      expect(applicationActor.roleCodes).toContain("APPLICATION_ADMIN");
      expect(applicationActor.supportLeaseId).toBeFalsy();
      expect(applicationActor.personId).toBeFalsy();
      expect(applicationActor.globalPersonId).toBeFalsy();
      expect(applicationActor.membershipId).toBeFalsy();
      expect(applicationActor.collaboratorId).toBeFalsy();

      const tenantActor = await getCurrentActor(
        tenantAdminApi,
        authzHeaders(SUPPORT_TENANT_ID),
      );
      expect(tenantActor.scope).toBe("TENANT");
      expect(tenantActor.tenantId).toBe(SUPPORT_TENANT_ID);
      expect(tenantActor.roleCodes).toContain("TENANT_ADMIN");
      expect(tenantActor.permissions).toContain("support_access_leases.approve");
      expect(tenantActor.permissions).toContain("support_access_leases.terminate");

      const expired = await listLeases(applicationAdminApi, {
        tenantId: EXPIRED_TENANT_ID,
        status: "EXPIRED",
      });
      const expiredFixture = expired.find(
        (lease) => lease.id === EXPIRED_PENDING_LEASE_ID,
      );
      expect(expiredFixture).toBeDefined();
      expect(expiredFixture?.status).toBe("PENDING");
      expect(expiredFixture?.effectiveStatus).toBe("EXPIRED");
      expect(expiredFixture?.permissions).toEqual(["people.read"]);

      const pending = await listLeases(applicationAdminApi, {
        tenantId: EXPIRED_TENANT_ID,
        status: "PENDING",
      });
      expect(pending.some((lease) => lease.id === EXPIRED_PENDING_LEASE_ID)).toBe(
        false,
      );
    } finally {
      await tenantAdminApi.dispose();
      await applicationAdminApi.dispose();
    }
  });

  test("request through termination enforces lease allowlist, Tenant isolation, control-plane denial, audit attribution, and identity non-mutation", async () => {
    const applicationAdminApi = await newApplicationAdminApi();
    const tenantAdminApi = await newTenantAdminApi(SUPPORT_TENANT_ID);
    const otherTenantAdminApi = await newTenantAdminApi(OTHER_TENANT_ID);

    try {
      await closeOpenLeases(applicationAdminApi, tenantAdminApi, SUPPORT_TENANT_ID);

      const globalBefore = await getCurrentActor(
        applicationAdminApi,
        applicationTenantHeaders("*"),
      );
      expect(globalBefore.actorKey).toBe(E2E_APPLICATION_ADMIN_ACTOR_ID);
      expect(globalBefore.scope).toBe("APPLICATION");
      expect(globalBefore.tenantId).toBe("*");
      expect(globalBefore.roleCodes).toContain("APPLICATION_ADMIN");
      expect(globalBefore.personId).toBeFalsy();
      expect(globalBefore.globalPersonId).toBeFalsy();
      expect(globalBefore.membershipId).toBeFalsy();
      expect(globalBefore.collaboratorId).toBeFalsy();

      const eligibleResponse = await applicationAdminApi.get(
        e2eApiUrl("/api/v1/authz/support-access-leases/eligible-permissions"),
        { headers: applicationTenantHeaders("*") },
      );
      await expectStatus(
        eligibleResponse,
        200,
        "list eligible Tenant Support Access Lease permissions",
      );
      const eligibleEnvelope = (await eligibleResponse.json()) as ApiEnvelope<Permission[]>;
      const eligibleCodes = (eligibleEnvelope.data ?? []).map((permission) => permission.code);
      expect(eligibleCodes).toContain("people.read");
      expect(eligibleCodes).not.toContain("authz.read");
      expect(eligibleCodes).not.toContain("authz.manage");
      expect(eligibleCodes).not.toContain("support_access_leases.approve");

      const invalidPermissionResponse = await applicationAdminApi.post(
        e2eApiUrl("/api/v1/authz/support-access-leases"),
        {
          headers: applicationTenantHeaders("*"),
          data: {
            tenantId: OTHER_TENANT_ID,
            expiresAt: futureTimestamp(15),
            reason: "E2E must reject application control-plane authority in a Tenant support lease",
            permissions: ["authz.read"],
          },
        },
      );
      await expectStatus(
        invalidPermissionResponse,
        400,
        "reject a control-plane permission from the Tenant support allowlist",
      );
      await expectValidationField(invalidPermissionResponse, "permissions");

      const requestedExpiration = futureTimestamp(15);
      const requestResponse = await applicationAdminApi.post(
        e2eApiUrl("/api/v1/authz/support-access-leases"),
        {
          headers: applicationTenantHeaders("*"),
          data: {
            tenantId: SUPPORT_TENANT_ID,
            expiresAt: requestedExpiration,
            reason: "E2E authorization coverage for exact-Tenant temporary support",
            permissions: ["people.read"],
          },
        },
      );
      await expectStatus(requestResponse, 201, "request Tenant support access");
      const requestedLease = await responseData<SupportAccessLease>(
        requestResponse,
        "request Tenant support access",
      );
      expect(requestedLease.tenantId).toBe(SUPPORT_TENANT_ID);
      expect(requestedLease.status).toBe("PENDING");
      expect(requestedLease.effectiveStatus).toBe("PENDING");
      expect(requestedLease.permissions).toEqual(["people.read"]);
      expect(requestedLease.applicationActorId).toBe(globalBefore.actorRecordId);
      expect(requestedLease.requestedByActorId).toBe(globalBefore.actorRecordId);
      expect(requestedLease.expiresAt).toBe(requestedExpiration);

      const duplicateResponse = await applicationAdminApi.post(
        e2eApiUrl("/api/v1/authz/support-access-leases"),
        {
          headers: applicationTenantHeaders("*"),
          data: {
            tenantId: SUPPORT_TENANT_ID,
            expiresAt: futureTimestamp(20),
            reason: "Duplicate E2E request must be rejected",
            permissions: ["people.read"],
          },
        },
      );
      await expectStatus(duplicateResponse, 409, "reject duplicate open support request");
      await expectErrorCode(duplicateResponse, "support_access_lease_conflict");

      const wrongTenantApproval = await otherTenantAdminApi.post(
        e2eApiUrl(
          `/api/v1/authz/support-access-leases/${encodeURIComponent(requestedLease.id)}/approve`,
        ),
        { headers: authzHeaders(OTHER_TENANT_ID) },
      );
      await expectStatus(
        wrongTenantApproval,
        403,
        "reject approval by a Tenant Administrator from another Tenant",
      );
      await expectErrorCode(wrongTenantApproval, "forbidden");

      const approvalResponse = await tenantAdminApi.post(
        e2eApiUrl(
          `/api/v1/authz/support-access-leases/${encodeURIComponent(requestedLease.id)}/approve`,
        ),
        { headers: authzHeaders(SUPPORT_TENANT_ID) },
      );
      await expectStatus(approvalResponse, 200, "approve support access in the exact Tenant");
      const approvedLease = await responseData<SupportAccessLease>(
        approvalResponse,
        "approve support access in the exact Tenant",
      );
      expect(approvedLease.status).toBe("APPROVED");
      expect(approvedLease.effectiveStatus).toBe("APPROVED");
      expect(approvedLease.expiresAt).toBe(requestedExpiration);
      expect(approvedLease.permissions).toEqual(["people.read"]);

      const leasedActor = await getCurrentActor(
        applicationAdminApi,
        applicationTenantHeaders(SUPPORT_TENANT_ID),
      );
      expect(leasedActor.actorKey).toBe(globalBefore.actorKey);
      expect(leasedActor.actorRecordId).toBe(globalBefore.actorRecordId);
      expect(leasedActor.scope).toBe("APPLICATION");
      expect(leasedActor.tenantId).toBe(SUPPORT_TENANT_ID);
      expect(leasedActor.roleCodes).toContain("APPLICATION_ADMIN");
      expect(leasedActor.supportLeaseId).toBe(requestedLease.id);
      expect(leasedActor.supportLeaseExpiresAt).toBe(requestedExpiration);
      expect(leasedActor.supportLeasePermissions).toEqual(["people.read"]);
      expect(leasedActor.personId).toBeFalsy();
      expect(leasedActor.globalPersonId).toBeFalsy();
      expect(leasedActor.membershipId).toBeFalsy();
      expect(leasedActor.collaboratorId).toBeFalsy();

      const peopleResponse = await applicationAdminApi.get(
        e2eApiUrl("/api/v1/people?page=1&pageSize=1"),
        { headers: applicationTenantHeaders(SUPPORT_TENANT_ID) },
      );
      await expectStatus(
        peopleResponse,
        200,
        "lease-backed Application Administrator may use the leased people.read permission",
      );

      const expensesResponse = await applicationAdminApi.get(
        e2eApiUrl("/api/v1/expenses?page=1&pageSize=1"),
        { headers: applicationTenantHeaders(SUPPORT_TENANT_ID) },
      );
      await expectStatus(
        expensesResponse,
        403,
        "lease-backed Application Administrator must not use an unleased Tenant permission",
      );
      await expectErrorCode(expensesResponse, "forbidden");

      const controlPlaneResponse = await applicationAdminApi.get(
        e2eApiUrl("/api/v1/authz/roles"),
        { headers: applicationTenantHeaders(SUPPORT_TENANT_ID) },
      );
      await expectStatus(
        controlPlaneResponse,
        403,
        "lease-backed Application Administrator must not use global authorization administration",
      );
      await expectErrorCode(controlPlaneResponse, "forbidden");

      const otherTenantResponse = await applicationAdminApi.get(
        e2eApiUrl("/api/v1/authz/current-actor"),
        { headers: applicationTenantHeaders(OTHER_TENANT_ID) },
      );
      await expectStatus(
        otherTenantResponse,
        403,
        "a lease for one Tenant must not resolve support authority in another Tenant",
      );
      await expectErrorCode(otherTenantResponse, "tenant_actor_unavailable");

      const auditResponse = await tenantAdminApi.get(
        e2eApiUrl(
          `/api/v1/authz/support-access-leases/${encodeURIComponent(requestedLease.id)}/audit-logs`,
        ),
        { headers: authzHeaders(SUPPORT_TENANT_ID) },
      );
      await expectStatus(
        auditResponse,
        200,
        "exact-Tenant Administrator may review lease-specific audit history",
      );
      const auditLogs = await responseData<AuditLog[]>(
        auditResponse,
        "read lease-specific support audit history",
      );
      expectLeaseAudit(
        auditLogs,
        requestedLease.id,
        "support_access_leases.request",
        "support_access_leases.request",
        "AUTHORIZED",
      );
      expectLeaseAudit(
        auditLogs,
        requestedLease.id,
        "support_access_leases.approve",
        "support_access_leases.approve",
        "AUTHORIZED",
      );
      expectLeaseAudit(
        auditLogs,
        requestedLease.id,
        "support_access.use",
        "people.read",
        "AUTHORIZED",
        "GET",
        "/api/v1/people",
      );
      expectLeaseAudit(
        auditLogs,
        requestedLease.id,
        "support_access.use",
        "expenses.read",
        "DENIED",
        "GET",
        "/api/v1/expenses",
      );
      expectLeaseAudit(
        auditLogs,
        requestedLease.id,
        "support_access.use",
        "authz.read",
        "DENIED",
        "GET",
        "/api/v1/authz/roles",
      );

      const terminationResponse = await tenantAdminApi.post(
        e2eApiUrl(
          `/api/v1/authz/support-access-leases/${encodeURIComponent(requestedLease.id)}/terminate`,
        ),
        {
          headers: authzHeaders(SUPPORT_TENANT_ID),
          data: { reason: "E2E authorization lifecycle complete" },
        },
      );
      await expectStatus(terminationResponse, 200, "terminate the approved support lease");
      const terminatedLease = await responseData<SupportAccessLease>(
        terminationResponse,
        "terminate the approved support lease",
      );
      expect(terminatedLease.status).toBe("TERMINATED");
      expect(terminatedLease.effectiveStatus).toBe("TERMINATED");
      expect(terminatedLease.expiresAt).toBe(requestedExpiration);

      const afterTerminationResponse = await applicationAdminApi.get(
        e2eApiUrl("/api/v1/authz/current-actor"),
        { headers: applicationTenantHeaders(SUPPORT_TENANT_ID) },
      );
      await expectStatus(
        afterTerminationResponse,
        403,
        "terminated support lease must immediately remove Tenant authority",
      );
      await expectErrorCode(afterTerminationResponse, "tenant_actor_unavailable");

      const globalAfter = await getCurrentActor(
        applicationAdminApi,
        applicationTenantHeaders("*"),
      );
      expect(globalAfter.actorKey).toBe(globalBefore.actorKey);
      expect(globalAfter.actorRecordId).toBe(globalBefore.actorRecordId);
      expect(globalAfter.scope).toBe("APPLICATION");
      expect(globalAfter.tenantId).toBe("*");
      expect(globalAfter.roleCodes).toEqual(globalBefore.roleCodes);
      expect(globalAfter.personId).toBeFalsy();
      expect(globalAfter.globalPersonId).toBeFalsy();
      expect(globalAfter.membershipId).toBeFalsy();
      expect(globalAfter.collaboratorId).toBeFalsy();
      expect(globalAfter.supportLeaseId).toBeFalsy();
    } finally {
      await closeOpenLeases(applicationAdminApi, tenantAdminApi, SUPPORT_TENANT_ID).catch(
        (error) => {
          console.warn(`Unable to clean an open E2E support lease: ${String(error)}`);
        },
      );
      await otherTenantAdminApi.dispose();
      await tenantAdminApi.dispose();
      await applicationAdminApi.dispose();
    }
  });
});

function applicationTenantHeaders(tenantId: string): Record<string, string> {
  return {
    ...applicationAdminHeaders(),
    "X-Tenant-ID": tenantId,
  };
}

function futureTimestamp(minutes: number): string {
  const nowToSecond = Math.floor(Date.now() / 1000) * 1000;
  return new Date(nowToSecond + minutes * 60_000).toISOString().replace(".000Z", "Z");
}

async function getCurrentActor(
  api: APIRequestContext,
  headers: Record<string, string>,
): Promise<CurrentActor> {
  const response = await api.get(e2eApiUrl("/api/v1/authz/current-actor"), { headers });
  await expectStatus(response, 200, "resolve current authorization actor");
  return responseData<CurrentActor>(response, "resolve current authorization actor");
}

async function listLeases(
  api: APIRequestContext,
  filter: { tenantId?: string; status?: string },
): Promise<SupportAccessLease[]> {
  const query = new URLSearchParams();
  if (filter.tenantId) query.set("tenantId", filter.tenantId);
  if (filter.status) query.set("status", filter.status);
  const response = await api.get(
    e2eApiUrl(`/api/v1/authz/support-access-leases?${query.toString()}`),
    { headers: applicationTenantHeaders("*") },
  );
  await expectStatus(response, 200, "list Tenant Support Access Leases");
  return responseData<SupportAccessLease[]>(response, "list Tenant Support Access Leases");
}

async function closeOpenLeases(
  applicationAdminApi: APIRequestContext,
  tenantAdminApi: APIRequestContext,
  tenantId: string,
): Promise<void> {
  const leases = await listLeases(applicationAdminApi, { tenantId });
  for (const lease of leases) {
    if (lease.effectiveStatus !== "PENDING" && lease.effectiveStatus !== "APPROVED") {
      continue;
    }

    if (lease.effectiveStatus === "PENDING") {
      const approval = await tenantAdminApi.post(
        e2eApiUrl(
          `/api/v1/authz/support-access-leases/${encodeURIComponent(lease.id)}/approve`,
        ),
        { headers: authzHeaders(tenantId) },
      );
      if (approval.status() === 409) {
        continue;
      }
      await expectStatus(approval, 200, `clean up pending support lease ${lease.id}`);
    }

    const termination = await tenantAdminApi.post(
      e2eApiUrl(
        `/api/v1/authz/support-access-leases/${encodeURIComponent(lease.id)}/terminate`,
      ),
      {
        headers: authzHeaders(tenantId),
        data: { reason: "Playwright deterministic fixture cleanup" },
      },
    );
    if (termination.status() === 409) {
      continue;
    }
    await expectStatus(termination, 200, `clean up approved support lease ${lease.id}`);
  }
}

function expectLeaseAudit(
  logs: AuditLog[],
  leaseId: string,
  operation: string,
  permissionCode: string,
  decision: string,
  requestMethod?: string,
  requestPath?: string,
): void {
  const entry = logs.find(
    (candidate) =>
      candidate.supportLeaseId === leaseId &&
      candidate.operation === operation &&
      candidate.permissionCode === permissionCode &&
      candidate.decision === decision &&
      (!requestMethod || candidate.requestMethod === requestMethod) &&
      (!requestPath || candidate.requestPath === requestPath),
  );
  expect(
    entry,
    `expected ${decision} ${operation} audit for ${permissionCode} on lease ${leaseId}`,
  ).toBeDefined();
  expect(entry?.tenantId).toBe(SUPPORT_TENANT_ID);
}

async function responseData<T>(response: APIResponse, context: string): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (envelope.data === undefined) {
    throw new Error(`${context}: response did not include data`);
  }
  return envelope.data;
}

async function expectStatus(
  response: APIResponse,
  expectedStatus: number,
  context: string,
): Promise<void> {
  if (response.status() !== expectedStatus) {
    throw new Error(
      `${context}: expected HTTP ${expectedStatus}, got ${response.status()} ${await response.text()}`,
    );
  }
}

async function expectErrorCode(response: APIResponse, expectedCode: string): Promise<void> {
  const body = (await response.json()) as ApiEnvelope<unknown>;
  expect(body.error?.code).toBe(expectedCode);
}

async function expectValidationField(response: APIResponse, fieldName: string): Promise<void> {
  const body = (await response.json()) as ApiEnvelope<unknown>;
  expect(body.error?.fields?.[fieldName]).toBeTruthy();
}
