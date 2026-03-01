import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const services = await getServices();
    const principal = getPrincipal(request, services, id);
    requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);
    const body = await request.json().catch(() => ({})) as { count?: number };
    const count = Number(body.count ?? 100);
    const seeded = services.payroll.seedEmployees(id, count);
    return jsonResponse({ seeded });
  } catch (error) {
    return errorResponse(error);
  }
}
