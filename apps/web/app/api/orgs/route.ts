import { NextRequest } from "next/server";
import { createOrgSchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { parseBody } from "@/lib/server/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(request: NextRequest) {
  try {
    const services = await getServices();
    const body = await request.json();
    const payload = parseBody(createOrgSchema, body);
    const org = services.onboarding.createOrg(payload);
    return jsonResponse({ ...org, nextStep: "kyb" }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
