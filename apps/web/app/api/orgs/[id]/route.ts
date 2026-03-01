import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { jsonResponse } from "@/lib/server/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const services = await getServices();
  const org = services.store.getOrg(id);

  if (!org) {
    return jsonResponse({ error: "ORG_NOT_FOUND" }, 404);
  }

  return jsonResponse(org);
}
