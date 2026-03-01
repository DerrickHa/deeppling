import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { jsonResponse } from "@/lib/server/response";

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return jsonResponse({ error: "orgId query parameter is required" }, 400);
  }

  const services = await getServices();
  return jsonResponse(services.store.getChecklist(orgId));
}
