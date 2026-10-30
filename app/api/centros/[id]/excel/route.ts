import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/guard";
import { excelFileName } from "@/lib/domain/filenames";
import { buildCenterExcel } from "@/lib/excel/build";
import { AppError, publicError } from "@/lib/errors";
import { getCenter } from "@/lib/repositories/centers";
import { listRecords } from "@/lib/repositories/records";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { id } = await context.params;
    const center = await getCenter(id);
    if (!center) return NextResponse.json({ error: "No se encontró el centro." }, { status: 404 });
    const includePending = new URL(request.url).searchParams.get("pendientes") === "1";
    const records = await listRecords(id);
    const { buffer, issues } = await buildCenterExcel(center, records, includePending);
    const filename = excelFileName(center);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Warnings": String(issues.length),
      },
    });
  } catch (error) {
    const appError = error instanceof AppError ? error : publicError(error, "No se pudo generar el Excel.");
    return NextResponse.json({ error: appError.message }, { status: appError.status });
  }
}
