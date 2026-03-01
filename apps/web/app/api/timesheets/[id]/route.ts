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
    const timesheet = services.store.getTimesheet(id);
    if (!timesheet) {
      throw new Error("TIMESHEET_NOT_FOUND");
    }

    const principal = getPrincipal(request, services, timesheet.orgId);
    requireRoles(principal, ["Contractor", "OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor"]);
    const result = services.contractor.getTimesheet(id);
    const contractor = services.store.getContractor(result.timesheet.contractorId);
    const canView =
      canRoleViewAmounts(principal.role) ||
      (principal.role === "Contractor" &&
        contractor &&
        contractor.email.toLowerCase() === principal.email.toLowerCase());

    return jsonResponse({
      ...result,
      canViewAmounts: canView,
      timesheet: {
        ...result.timesheet,
        totalAmountCents: canView ? result.timesheet.totalAmountCents : 0,
        maskedAmount: !canView
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
