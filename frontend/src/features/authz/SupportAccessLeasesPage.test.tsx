import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationProvider, type AuthorizationContextValue } from "../../components/layout/AuthorizationContext";
import { SupportAccessLeasesPage } from "./SupportAccessLeasesPage";

let container: HTMLDivElement;
let root: Root | null;
let calls: Array<{ url: string; method: string }>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = null;
  calls = [];
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  document.body.removeChild(container);
  vi.restoreAllMocks();
});

describe("SupportAccessLeasesPage", () => {
  it("gives the Global Application Administrator a backend-owned request catalog and retained history", async () => {
    mockFetch(async (url, init) => {
      calls.push({ url, method: init?.method?.toUpperCase() ?? "GET" });
      if (url === "/api/v1/tenants") {
        return jsonResponse({ data: [{ id: "default", code: "DEFAULT", name: "Tenant A", active: true, operationalStatus: "ACTIVE_READY", tenantAdminCount: 1, createdAt: "", updatedAt: "" }] });
      }
      if (url === "/api/v1/authz/support-access-leases/eligible-permissions") {
        return jsonResponse({ data: [{ code: "people.read", label: "Read People", description: "Read Tenant People." }] });
      }
      if (url.startsWith("/api/v1/authz/support-access-leases")) {
        return jsonResponse({ data: [pendingLease] });
      }
      throw new Error(`Unhandled request: ${url}`);
    });

    renderPage(applicationAdminContext);

    await waitForText("Request Tenant support access");
    await waitForText("Read People");
    await waitForText("Lease history");
    await waitForText("lease-pending");
    expect(container.textContent).toContain("Control-plane and Tenant Administrator authority cannot be leased");
  });

  it("lets the exact Tenant Administrator approve a non-expired pending lease and review its audit trail", async () => {
    let approved = false;
    mockFetch(async (url, init) => {
      calls.push({ url, method: init?.method?.toUpperCase() ?? "GET" });
      if (url === "/api/v1/authz/support-access-leases/eligible-permissions") {
        return jsonResponse({ data: [{ code: "people.read", label: "Read People", description: "Read Tenant People." }] });
      }
      if (url === "/api/v1/authz/support-access-leases/lease-pending/approve" && init?.method === "POST") {
        approved = true;
        return jsonResponse({ data: { ...pendingLease, status: "APPROVED", effectiveStatus: "APPROVED", approvedByActorId: "tenant-admin-actor" } });
      }
      if (url === "/api/v1/authz/support-access-leases/lease-pending/audit-logs") {
        return jsonResponse({ data: [{ id: "audit-1", occurredAt: "2026-09-07T12:00:00Z", actorId: "bootstrap-admin", tenantId: "default", supportLeaseId: "lease-pending", operation: "support_access_leases.request", decision: "AUTHORIZED", requestMethod: "POST", requestPath: "/api/v1/authz/support-access-leases" }] });
      }
      if (url.startsWith("/api/v1/authz/support-access-leases")) {
        return jsonResponse({ data: [pendingLease] });
      }
      throw new Error(`Unhandled request: ${url}`);
    });

    renderPage(tenantAdminContext);

    await waitForText("Tenant boundary: Tenant A");
    await waitForText("Approve support access");
    await clickButton("Review audit trail");
    await waitForText("support_access_leases.request");
    await clickButton("Approve support access");
    await waitFor(() => approved);

    expect(calls.some((call) => call.url.endsWith("/lease-pending/approve") && call.method === "POST")).toBe(true);
  });
});

const pendingLease = {
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

const applicationAdminContext: AuthorizationContextValue = {
  actorKey: "bootstrap-admin",
  actorRecordId: "actor-bootstrap-admin",
  tenantId: "*",
  scope: "APPLICATION",
  roleCodes: ["APPLICATION_ADMIN"],
  permissions: ["support_access_leases.read", "support_access_leases.request", "tenants.read"],
  supportLeasePermissions: [],
  selectedTenantName: "Global administration",
  selectedTenantCode: "GLOBAL",
};

const tenantAdminContext: AuthorizationContextValue = {
  actorKey: "tenant-admin",
  actorRecordId: "tenant-admin-actor",
  tenantId: "default",
  scope: "TENANT",
  roleCodes: ["TENANT_ADMIN"],
  permissions: ["support_access_leases.read", "support_access_leases.approve", "support_access_leases.terminate"],
  supportLeasePermissions: [],
  selectedTenantName: "Tenant A",
  selectedTenantCode: "DEFAULT",
};

function renderPage(actor: AuthorizationContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={queryClient}>
        <AuthorizationProvider value={actor}>
          <SupportAccessLeasesPage />
        </AuthorizationProvider>
      </QueryClientProvider>,
    );
  });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  }));
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

async function waitForText(text: string) {
  await waitFor(() => Boolean(textNode(text)));
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error("Condition not reached");
}

function textNode(text: string) {
  return Array.from(container.querySelectorAll("*")).find((element) => element.textContent?.includes(text));
}

async function clickButton(name: string) {
  const button = Array.from(container.querySelectorAll("button")).find((element) => element.textContent?.includes(name)) as HTMLButtonElement | undefined;
  if (!button) throw new Error(`Button not found: ${name}`);
  await act(async () => button.click());
}
