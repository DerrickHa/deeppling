import { NextRequest } from "next/server";
import { inviteEmployeeSchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { parseBody } from "@/lib/server/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";
import { getAdminProgress } from "@/api-lib/lib/onboardingProgress";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const services = await getServices();
    const principal = getPrincipal(request, services, id);
    requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);
    const body = await request.json();
    const payload = parseBody(inviteEmployeeSchema, body);
    const employee = services.onboarding.inviteEmployee(id, principal.email, payload.email);
    const org = services.store.getOrg(id);
    if (!org) {
      return jsonResponse({ error: "ORG_NOT_FOUND" }, 404);
    }
    const progress = getAdminProgress(org, services.store.getChecklist(id));
    return jsonResponse({
      employeeId: employee.id,
      email: employee.email,
      inviteToken: employee.invite.token,
      inviteExpiresAt: employee.invite.expiresAt,
      nextStep: progress.earliestIncompleteStep,
      progress
    }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
