import { NextRequest } from "next/server";
import { submitTimesheetSchema } from "@deeppling/shared";
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
    const contractor = services.store.getContractor(id);
    if (!contractor) {
      throw new Error("CONTRACTOR_NOT_FOUND");
    }

    const principal = getPrincipal(request, services, contractor.orgId);
    requireRoles(principal, ["Contractor", "OrgOwner", "PayrollAdmin"]);

    if (principal.role === "Contractor" && principal.email.toLowerCase() !== contractor.email.toLowerCase()) {
      throw new Error("UNAUTHORIZED_CONTRACTOR_SCOPE");
    }

    const payload = parseBody(submitTimesheetSchema, await request.json());
    const result = services.contractor.submitTimesheet(id, payload);
    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
