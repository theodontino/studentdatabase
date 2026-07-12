import { NextResponse } from "next/server";
import { getLocalToolsStatus } from "@/services/local-tool-status-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getLocalToolsStatus());
}
