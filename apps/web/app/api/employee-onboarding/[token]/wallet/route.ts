import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { getEmployeeProgress } from "@/api-lib/lib/onboardingProgress";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const services = await getServices();
    const actor = request.headers.get("x-actor-email") ?? `invite:${token.slice(0, 8)}`;
    const employee = await services.onboarding.provisionWallet(token, actor);
    const progress = getEmployeeProgress(employee);
    return jsonResponse({
      ...employee,
      nextStep: progress.earliestIncompleteStep,
      progress
    });
  } catch (error) {
    return errorResponse(error);
  }
}
