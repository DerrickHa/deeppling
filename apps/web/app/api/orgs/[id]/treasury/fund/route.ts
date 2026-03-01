import { NextRequest } from "next/server";
import { getServices } from "@/lib/server/services";
import { jsonResponse, errorResponse } from "@/lib/server/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const services = await getServices();
    const org = services.store.getOrg(id);
    if (!org) {
      return jsonResponse({ error: "ORG_NOT_FOUND" }, 404);
    }

    const body = await request.json().catch(() => ({})) as { amount?: string; tokenAddress?: string };
    const unlink = services.unlink;

    if (!unlink.depositFromBurner || !unlink.getBurnerAddress) {
      return jsonResponse({
        error: "MOCK_MODE",
        message: "Treasury funding via burner is only available in real Unlink mode. Set USE_REAL_UNLINK=true."
      }, 400);
    }

    const burnerAddress = await unlink.getBurnerAddress();
    const tokenAddress = body?.tokenAddress ?? org.treasury.tokenAddress ?? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const amount = BigInt(body?.amount ?? "1000000000000000000"); // Default 1 MON

    const relayId = await unlink.depositFromBurner(amount, tokenAddress);

    return jsonResponse({
      success: true,
      relayId,
      burnerAddress,
      depositedAmount: amount.toString(),
      tokenAddress,
      message: "Deposit from burner into privacy pool confirmed."
    });
  } catch (error) {
    return errorResponse(error);
  }
}
