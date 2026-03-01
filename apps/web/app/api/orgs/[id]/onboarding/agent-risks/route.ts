import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const services = await getServices();
    const result = services.onboarding.analyzeOnboarding(id);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
