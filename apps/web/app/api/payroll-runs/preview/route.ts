import { NextRequest } from "next/server";
import { previewPayrollSchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { parseBody } from "@/api-lib/lib/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(request: NextRequest) {
  try {
    const services = await getServices();
    const payload = parseBody(previewPayrollSchema, await request.json());
    const principal = getPrincipal(request, services, payload.orgId);
    requireRoles(principal, ["OrgOwner", "PayrollAdmin", "FinanceApprover"]);
    const result = services.payroll.previewPayroll(payload);
    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
