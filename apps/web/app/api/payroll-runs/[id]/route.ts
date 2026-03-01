import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { canRoleViewAmounts, maskInstructionAmount } from "@/api-lib/lib/privacy";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const services = await getServices();
    const run = services.store.getRun(id);
    const principal = getPrincipal(request, services, run?.orgId);
    requireRoles(principal, ["Employee", "OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor"]);

    const result = services.payroll.getRun(id);
    const employee = result.run.orgId
      ? services
          .store
          .listOrgEmployees(result.run.orgId)
          .find((item) => item.email.toLowerCase() === principal.email.toLowerCase())
      : undefined;
    const canView = canRoleViewAmounts(principal.role);

    return jsonResponse({
      ...result,
      canViewAmounts: canView,
      instructions: result.instructions.map((instruction) => {
        const ownedByActor = !!employee && instruction.payeeId === employee.id;
        return maskInstructionAmount(instruction, canView || ownedByActor);
      })
    });
  } catch (error) {
    return errorResponse(error);
  }
}
