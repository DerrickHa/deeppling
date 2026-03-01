import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { jsonResponse, errorResponse } from "@/lib/server/response";
import { canRoleViewAmounts, maskInstructionAmount } from "@/api-lib/lib/privacy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const services = await getServices();
    const principal = getPrincipal(request, services, id);
    requireRoles(principal, ["OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor"]);

    const canView = canRoleViewAmounts(principal.role);
    const employee = services
      .store
      .listOrgEmployees(id)
      .find((item) => item.email.toLowerCase() === principal.email.toLowerCase());

    return jsonResponse({
      audit: services.store.listOrgAudit(id),
      agentLogs: services.store.listAgentLogs(id),
      attestations: services.store.listOrgAttestations(id),
      chainAnchors: services.store.listOrgChainAnchors(id),
      canViewAmounts: canView,
      payouts: services
        .store
        .listOrgInstructions(id)
        .map((instruction) => maskInstructionAmount(instruction, canView || (!!employee && instruction.payeeId === employee.id)))
    });
  } catch (error) {
    return errorResponse(error);
  }
}
