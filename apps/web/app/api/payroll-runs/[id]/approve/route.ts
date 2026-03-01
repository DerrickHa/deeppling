import { NextRequest } from "next/server";
import { approvePayrollSchema } from "@deeppling/shared";
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
    const run = services.store.getRun(id);
    const principal = getPrincipal(request, services, run?.orgId);
    requireRoles(principal, ["OrgOwner", "FinanceApprover"]);
    const payload = parseBody(approvePayrollSchema, await request.json());
    const result = services.payroll.approveRun(id, payload);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
