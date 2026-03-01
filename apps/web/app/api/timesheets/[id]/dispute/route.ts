import { NextRequest } from "next/server";
import { disputeTimesheetSchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { parseBody } from "@/api-lib/lib/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(
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
    requireRoles(principal, ["OrgOwner", "FinanceApprover", "PayrollAdmin"]);

    const payload = parseBody(disputeTimesheetSchema, await request.json());
    const result = services.contractor.disputeTimesheet(id, {
      reason: payload.reason,
      signature: payload.signature,
      actorEmail: principal.email,
      actorWalletAddress: principal.walletAddress ?? payload.signature.walletAddress
    });

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
