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
    const org = services.store.getOrg(id);
    if (!org) {
      return jsonResponse({ error: "ORG_NOT_FOUND" }, 404);
    }

    const unlink = services.unlink;
    let burnerAddress: string | undefined;
    let poolBalance: { tokenUnits: string; monWei: string } | undefined;

    if (unlink.getBurnerAddress) {
      burnerAddress = await unlink.getBurnerAddress();
    }

    if (org.treasury.accountId) {
      const tokenAddress = org.treasury.tokenAddress ?? org.payrollPolicy?.tokenAddress ?? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
      poolBalance = await unlink.getBalances(org.treasury.accountId, tokenAddress);
    }

    return jsonResponse({
      treasuryAccountId: org.treasury.accountId,
      treasuryStatus: org.treasury.status,
      fundedTokenUnits: org.treasury.fundedTokenUnits,
      fundedMonUnits: org.treasury.fundedMonUnits,
      poolBalance,
      burnerAddress,
      faucetUrl: burnerAddress ? `https://faucet.monad.xyz` : undefined
    });
  } catch (error) {
    return errorResponse(error);
  }
}
