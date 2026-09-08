import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveSupportAccessLease,
  listEligibleSupportAccessLeasePermissions,
  listSupportAccessLeaseAuditLogs,
  listSupportAccessLeases,
  requestSupportAccessLease,
  terminateSupportAccessLease,
} from "../../api/authz.api";
import type {
  AuthzAdminRequestActor,
  CreateSupportAccessLeaseInput,
  SupportAccessLeaseFilters,
} from "../../types/authz";

function enabled(actor: AuthzAdminRequestActor) {
  return Boolean(actor.actorId.trim() && actor.tenantId.trim());
}

function key(actor: AuthzAdminRequestActor) {
  return ["support-access-leases", actor.actorId, actor.tenantId] as const;
}

export function useSupportAccessLeases(
  actor: AuthzAdminRequestActor,
  filters: SupportAccessLeaseFilters = {},
) {
  return useQuery({
    queryKey: [...key(actor), "list", filters],
    queryFn: () => listSupportAccessLeases(actor, filters),
    enabled: enabled(actor),
  });
}

export function useEligibleSupportAccessLeasePermissions(actor: AuthzAdminRequestActor) {
  return useQuery({
    queryKey: [...key(actor), "eligible-permissions"],
    queryFn: () => listEligibleSupportAccessLeasePermissions(actor),
    enabled: enabled(actor),
    staleTime: 5 * 60_000,
  });
}

export function useSupportAccessLeaseAuditLogs(
  actor: AuthzAdminRequestActor,
  leaseId: string,
) {
  return useQuery({
    queryKey: [...key(actor), "audit", leaseId],
    queryFn: () => listSupportAccessLeaseAuditLogs(actor, leaseId),
    enabled: enabled(actor) && Boolean(leaseId.trim()),
  });
}

export function useRequestSupportAccessLease(actor: AuthzAdminRequestActor) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupportAccessLeaseInput) =>
      requestSupportAccessLease(actor, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key(actor) });
    },
  });
}

export function useApproveSupportAccessLease(actor: AuthzAdminRequestActor) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => approveSupportAccessLease(actor, leaseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key(actor) });
    },
  });
}

export function useTerminateSupportAccessLease(actor: AuthzAdminRequestActor) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leaseId, reason }: { leaseId: string; reason: string }) =>
      terminateSupportAccessLease(actor, leaseId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key(actor) });
    },
  });
}
