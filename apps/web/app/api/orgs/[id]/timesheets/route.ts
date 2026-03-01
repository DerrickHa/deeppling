import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { canRoleViewAmounts } from "@/api-lib/lib/privacy";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const services = await getServices();
    const principal = getPrincipal(request, services, id);
    requireRoles(principal, ["Contractor", "OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor"]);

    const timesheets = services.contractor.listOrgTimesheets(id);
    const canView = canRoleViewAmounts(principal.role);
    const contractorById = new Map(services.contractor.listOrgContractors(id).map((item) => [item.id, item]));

    return jsonResponse({
      canViewAmounts: canView,
      timesheets: timesheets.map((timesheet) => {
        const contractor = contractorById.get(timesheet.contractorId);
        const isOwner =
          principal.role === "Contractor" &&
          contractor &&
          contractor.email.toLowerCase() === principal.email.toLowerCase();

        return {
          ...timesheet,
          totalAmountCents: canView || !!isOwner ? timesheet.totalAmountCents : 0,
          maskedAmount: !(canView || !!isOwner)
        };
      })
    });
  } catch (error) {
    return errorResponse(error);
  }
}
