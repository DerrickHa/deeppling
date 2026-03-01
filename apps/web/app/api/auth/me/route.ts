import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "UNAUTHORIZED_TOKEN_REQUIRED" }, 401);
  }

  try {
    const services = await getServices();
    const token = authHeader.slice("Bearer ".length).trim();
    const context = services.auth.authenticate(token);
    return jsonResponse({
      user: context.user,
      session: context.session,
      roles: context.roles
    });
  } catch (error) {
    return errorResponse(error);
  }
}
