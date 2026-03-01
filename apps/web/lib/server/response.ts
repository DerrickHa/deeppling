import { NextResponse } from "next/server";
import { parseError } from "./http";

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: unknown) {
  const { statusCode, message } = parseError(error);
  return NextResponse.json({ error: message }, { status: statusCode });
}
