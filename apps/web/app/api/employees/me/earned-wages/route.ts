import { NextRequest } from "next/server";
import { earnedWageAvailabilityQuerySchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { jsonResponse, errorResponse } from "@/lib/server/response";
import type { ServiceContainer } from "@/api-lib/services/container";

const resolveEmployeeId = (
  services: ServiceContainer,
  orgId: string,
  providedEmployeeId: string | undefined,
  actorEmail: string
): string => {
  if (providedEmployeeId) {
    return providedEmployeeId;
  }

  const employee = services
    .store
    .listOrgEmployees(orgId)
    .find((item) => item.email.toLowerCase() === actorEmail.toLowerCase());

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND_FOR_ACTOR");
  }

  return employee.id;
};

export async function GET(request: NextRequest) {
  try {
    const services = await getServices();
    const orgId = request.nextUrl.searchParams.get("orgId");
    const employeeId = request.nextUrl.searchParams.get("employeeId") ?? undefined;
    const asOf = request.nextUrl.searchParams.get("asOf") ?? undefined;

    if (!orgId) {
      throw new Error("BAD_REQUEST:orgId query parameter is required");
    }

    const principal = getPrincipal(request, services, orgId);
    requireRoles(principal, ["Employee", "OrgOwner", "PayrollAdmin", "FinanceApprover"]);

    const queryPayload = earnedWageAvailabilityQuerySchema.parse({
      employeeId,
      asOf
    });

    const resolvedEmployeeId = resolveEmployeeId(services, orgId, queryPayload.employeeId, principal.email);

    const availability = services.earnedWage.getAvailability({
      orgId,
      employeeId: resolvedEmployeeId,
      asOf: queryPayload.asOf
    });

    return jsonResponse(availability);
  } catch (error) {
    return errorResponse(error);
  }
}
