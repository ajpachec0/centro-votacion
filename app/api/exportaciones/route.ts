import JSZip from "jszip";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guard";
import { excelFileName } from "@/lib/domain/filenames";
import { buildCenterExcel } from "@/lib/excel/build";
import { AppError, publicError } from "@/lib/errors";
import { getCenter } from "@/lib/repositories/centers";
import { listRecords } from "@/lib/repositories/records";

const bodySchema = z.object({
  centerIds: z.array(z.string().min(8)).min(1).max(300),
  includePending: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Seleccione al menos un centro." }, { status: 400 });
    }
    const zip = new JSZip();
    const failures: string[] = [];
    const usedNames = new Set<string>();
    for (const centerId of parsed.data.centerIds) {
      const center = await getCenter(centerId);
      if (!center) {
        failures.push("Un centro seleccionado ya no existe.");
        continue;
      }
      try {
        const records = await listRecords(center.id);
        const { buffer } = await buildCenterExcel(center, records, parsed.data.includePending);
        let filename = excelFileName(center);
        if (usedNames.has(filename)) filename = `${center.id.slice(0, 8)}-${filename}`;
        usedNames.add(filename);
        zip.file(filename, buffer);
      } catch (error) {
        const message = error instanceof AppError ? error.message : "No se pudo generar el Excel.";
        failures.push(`${center.name}: ${message}`);
      }
    }
    if (failures.length > 0) {
      return NextResponse.json(
        { error: "No se creó el ZIP porque uno o más centros no pudieron exportarse.", failures },
        { status: 409 },
      );
    }
    const archive = await zip.generateAsync({ type: "nodebuffer" });
    return new NextResponse(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="centros-votacion.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const appError = error instanceof AppError ? error : publicError(error, "No se pudo crear el ZIP.");
    return NextResponse.json({ error: appError.message }, { status: appError.status });
  }
}
