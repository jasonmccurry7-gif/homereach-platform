import { NextResponse } from "next/server";
import { markStormReachProposalRequested } from "@/lib/stormreach/repository";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const body = await request.json().catch(() => ({})) as { note?: string };
  const result = await markStormReachProposalRequested(token, { note: body.note });
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
