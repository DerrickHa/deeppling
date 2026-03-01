import { NextResponse } from "next/server";
import { config } from "@/api-lib/config";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "deeppling-api",
    monadChainId: config.monadChainId,
    monadRpcUrl: config.monadRpcUrl,
    unlinkMode: config.useRealUnlink ? "real" : "mock"
  });
}
