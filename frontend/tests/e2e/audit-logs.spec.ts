import { expect, test } from "@playwright/test";
import { applicationAdminHeaders, seedBrowserApplicationAdmin } from "./support/authz";
import { applicationAdminStorageStatePath } from "./support/storage";

test.use({
  storageState: applicationAdminStorageStatePath,
  extraHTTPHeaders: applicationAdminHeaders(),
});

test.beforeEach(async ({ page }) => {
  await seedBrowserApplicationAdmin(page);
});

test("admin can view and filter sensitive audit logs", async ({ page }) => {
  const requestedUrls: string[] = [];

  await page.route("**/api/v1/authz/audit-logs**", async (route) => {
    requestedUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "audit-e2e-partial-payout",
            occurredAt: "2026-06-22T14:00:00Z",
            accountId: "account-bootstrap-admin",
            actorId: "bootstrap-admin",
            actorRecordId: "actor-bootstrap-admin",
            actorScope: "APPLICATION",
            tenantId: "default",
            sessionId: "session-bootstrap-admin",
            correlationId: "correlation-partial-payout",
            permissionCode: "journey_settlements.partial_payout",
            authorizationSource: "GLOBAL_CONTROL_PLANE",
            authorizationSourceId: "grant-bootstrap-admin",
            authorizationRoleCode: "APPLICATION_ADMIN",
            operation: "current_accounts.partial_payout",
            targetType: "collaborator",
            targetId: "collab-e2e-1",
            decision: "AUTHORIZED",
            metadataJson: JSON.stringify({
              reasonCode: "COLLABORATOR_REQUESTED_PAYOUT",
              reasonText: "Collaborator requested payout.",
              recentReauthentication: {
                authenticatedAt: "2026-06-22T13:59:00Z",
                method: "password",
              },
              secondApproval: {
                approvedBy: "second-admin@example.com",
                notes: "Reviewed payout.",
              },
            }),
            requestMethod: "POST",
            requestPath: "/api/v1/collaborators/collab-e2e-1/payout",
          },
          {
            id: "audit-e2e-denied-reversal",
            occurredAt: "2026-06-22T13:00:00Z",
            actorId: "expense-operator@example.com",
            tenantId: "default",
            permissionCode: "ledger.corrections.create",
            operation: "ledger_entries.reverse",
            targetType: "ledger_entry",
            targetId: "entry-e2e-1",
            decision: "DENIED",
            reason: "recent reauthentication is required",
            requestMethod: "POST",
            requestPath: "/api/v1/current-accounts/ledger-entries/entry-e2e-1/reverse",
          },
        ],
      }),
    });
  });

  await page.goto("/admin/audit-logs");

  await expect(page.getByRole("heading", { name: "Audit Log Viewer", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Authenticated authorization context" }),
  ).toBeVisible();
  await expect(page.getByLabel("Selected Tenant ID")).toHaveValue("*");
  const authorizedPayoutRow = page
    .getByTestId("audit-log-row")
    .filter({ hasText: "Partial payout" })
    .first();
  await expect(authorizedPayoutRow).toBeVisible();
  await expect(
    authorizedPayoutRow.locator("dd").filter({ hasText: "COLLABORATOR_REQUESTED_PAYOUT" }).first(),
  ).toBeVisible();
  await expect(
    authorizedPayoutRow.locator("dd").filter({ hasText: "second-admin@example.com" }).first(),
  ).toBeVisible();
  await expect(authorizedPayoutRow).toContainText("account-bootstrap-admin");
  await expect(authorizedPayoutRow).toContainText("session-bootstrap-admin");
  await expect(authorizedPayoutRow).toContainText("correlation-partial-payout");
  await expect(authorizedPayoutRow).toContainText("GLOBAL_CONTROL_PLANE · APPLICATION_ADMIN · grant-bootstrap-admin");

  const deniedReversalRow = page
    .getByTestId("audit-log-row")
    .filter({ hasText: "recent reauthentication is required" })
    .first();
  await expect(deniedReversalRow).toBeVisible();

  await page.getByLabel("Operation").selectOption("ledger_entries.reverse");
  await page.getByLabel("Decision").selectOption("DENIED");
  await page.getByRole("button", { name: "Apply Filters" }).click();

  await expect.poll(() => requestedUrls.some((url) => {
    const parsed = new URL(url);
    return parsed.searchParams.get("operation") === "ledger_entries.reverse" &&
      parsed.searchParams.get("decision") === "DENIED";
  })).toBeTruthy();
});
