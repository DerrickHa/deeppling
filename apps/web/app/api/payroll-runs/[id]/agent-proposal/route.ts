import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const services = await getServices();
    const run = services.store.getRun(id);
    const principal = getPrincipal(request, services, run?.orgId);
    requireRoles(principal, ["OrgOwner", "PayrollAdmin", "FinanceApprover"]);
    const result = services.payroll.generateAgentProposal(id);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
