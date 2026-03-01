import { NextRequest } from "next/server";
import { authLoginSchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { parseBody } from "@/lib/server/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(request: NextRequest) {
  try {
    const services = await getServices();
    const body = await request.json();
    const payload = parseBody(authLoginSchema, body);
    const result = services.auth.login(payload);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
