import { NextRequest } from "next/server";
import { createContractorSchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { canRoleViewAmounts } from "@/api-lib/lib/privacy";
import { parseBody } from "@/api-lib/lib/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const services = await getServices();
    const principal = getPrincipal(request, services, id);
    requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);

    const payload = parseBody(createContractorSchema, await request.json());
    const contractor = services.contractor.createContractor(id, principal.email, payload);
    return jsonResponse(contractor, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const services = await getServices();
    const principal = getPrincipal(request, services, id);
    requireRoles(principal, ["OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor", "Contractor"]);
    const canView = canRoleViewAmounts(principal.role);

    const contractors = services.contractor.listOrgContractors(id);
    return jsonResponse({
      canViewAmounts: canView,
      contractors: contractors.map((contractor) => {
        const isOwner = principal.role === "Contractor" && contractor.email.toLowerCase() === principal.email.toLowerCase();
        return {
          ...contractor,
          hourlyRateCents: canView || isOwner ? contractor.hourlyRateCents : 0,
          maskedAmount: !(canView || isOwner)
        };
      })
    });
  } catch (error) {
    return errorResponse(error);
  }
}
