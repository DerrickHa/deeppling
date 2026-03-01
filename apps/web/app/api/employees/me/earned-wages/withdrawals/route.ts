import { NextRequest } from "next/server";
import { createEarnedWageWithdrawalSchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { parseBody } from "@/api-lib/lib/http";
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
    const employeeIdParam = request.nextUrl.searchParams.get("employeeId") ?? undefined;

    if (!orgId) {
      throw new Error("BAD_REQUEST:orgId query parameter is required");
    }

    const principal = getPrincipal(request, services, orgId);
    requireRoles(principal, ["Employee", "OrgOwner", "PayrollAdmin", "FinanceApprover"]);

    const employeeId = resolveEmployeeId(services, orgId, employeeIdParam, principal.email);
    const employee = services.store.getEmployee(employeeId);
    if (!employee || employee.orgId !== orgId) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    if (principal.role === "Employee" && employee.email.toLowerCase() !== principal.email.toLowerCase()) {
      throw new Error("UNAUTHORIZED_EMPLOYEE_SCOPE");
    }

    return jsonResponse({
      withdrawals: services.earnedWage.listWithdrawals(employeeId)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const services = await getServices();
    const orgId = request.nextUrl.searchParams.get("orgId");

    if (!orgId) {
      throw new Error("BAD_REQUEST:orgId query parameter is required");
    }

    const principal = getPrincipal(request, services, orgId);
    requireRoles(principal, ["Employee", "OrgOwner", "PayrollAdmin", "FinanceApprover"]);

    const payload = parseBody(createEarnedWageWithdrawalSchema, await request.json());
    const employee = services.store.getEmployee(payload.employeeId);
    if (!employee || employee.orgId !== orgId) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    if (principal.role === "Employee" && employee.email.toLowerCase() !== principal.email.toLowerCase()) {
      throw new Error("UNAUTHORIZED_EMPLOYEE_SCOPE");
    }

    const result = await services.earnedWage.requestWithdrawal({
      orgId,
      employeeId: payload.employeeId,
      amountCents: payload.amountCents,
      asOf: payload.asOf,
      actorEmail: principal.email,
      signature: payload.signature
    });

    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
