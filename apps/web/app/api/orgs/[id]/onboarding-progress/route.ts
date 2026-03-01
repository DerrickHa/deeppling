import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { jsonResponse } from "@/lib/server/response";
import { getAdminProgress } from "@/api-lib/lib/onboardingProgress";

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

  const checklist = services.store.getChecklist(id);
  return jsonResponse(getAdminProgress(org, checklist));
}
