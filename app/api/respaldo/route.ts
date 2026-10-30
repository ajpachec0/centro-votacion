import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/guard";
import { AppError, publicError } from "@/lib/errors";
import { exportBackup, importBackup } from "@/lib/repositories/backup";

export async function GET() {
  try {
    await requireUser();
    const backup = await exportBackup();
    return NextResponse.json(backup, {
      headers: {
        "Content-Disposition": 'attachment; filename="respaldo-centros.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const appError = error instanceof AppError ? error : publicError(error, "No se pudo exportar el respaldo.");
    return NextResponse.json({ error: appError.message }, { status: appError.status });
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = (await request.json()) as { confirm?: boolean; backup?: unknown };
    if (body.confirm !== true) {
      return NextResponse.json(
        { error: "Confirme la importación. Los identificadores existentes se actualizan y no se borran los demás centros." },
        { status: 400 },
      );
    }
    const result = await importBackup(body.backup);
    return NextResponse.json({
      message: `Respaldo importado: ${result.centers} centros y ${result.records} registros.`,
    });
  } catch (error) {
    const appError = error instanceof AppError ? error : publicError(error, "No se pudo importar el respaldo.");
    return NextResponse.json({ error: appError.message }, { status: appError.status });
  }
}
