import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { buildExcelExport } from "@/lib/daily-outreach/server";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const range = url.searchParams.get("range") ?? "today";
    const { workbook, range: resolvedRange } = await buildExcelExport(range, guard.user?.id ?? null);
    const fileName = `homereach-daily-outreach-${resolvedRange.key}-${resolvedRange.startDate}-to-${resolvedRange.endDate}.xls`;

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[daily-outreach/export] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily outreach export failed" },
      { status: 500 }
    );
  }
}
