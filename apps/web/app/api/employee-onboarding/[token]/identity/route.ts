import { NextRequest } from "next/server";
import { identitySchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { getEmployeeProgress } from "@/api-lib/lib/onboardingProgress";
import { parseBody } from "@/api-lib/lib/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const services = await getServices();
    const payload = parseBody(identitySchema, await request.json());
    const actor = request.headers.get("x-actor-email") ?? `invite:${token.slice(0, 8)}`;
    const employee = services.onboarding.updateIdentity(token, actor, payload);
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
