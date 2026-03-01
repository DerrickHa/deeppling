import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { getEmployeeProgress } from "@/api-lib/lib/onboardingProgress";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const services = await getServices();
    const employee = services.onboarding.getEmployeeByInviteToken(token);
    const progress = getEmployeeProgress(employee);
    return jsonResponse({
      employeeId: employee.id,
      email: employee.email,
      onboarding: employee.onboarding,
      readiness: employee.readiness,
      inviteExpiresAt: employee.invite.expiresAt,
      nextStep: progress.earliestIncompleteStep,
      progress
    });
  } catch (error) {
    return errorResponse(error);
  }
}
