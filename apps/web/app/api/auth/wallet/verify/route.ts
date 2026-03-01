import { NextRequest } from "next/server";
import { walletVerifySchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { parseBody } from "@/lib/server/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(request: NextRequest) {
  try {
    const services = await getServices();
    const body = await request.json();
    const payload = parseBody(walletVerifySchema, body);
    const user = services.auth.verifyWallet(payload);
    return jsonResponse({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
