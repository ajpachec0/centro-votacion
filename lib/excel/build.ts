import "server-only";

import { applyRecordsToWorkbook, type ExportIssue } from "@/lib/excel/fill";
import { isMappingReady } from "@/lib/excel/types";
import { readMapping, workbookFromTemplate } from "@/lib/excel/storage";
import type { Assignment, Center } from "@/lib/domain/types";
import { AppError } from "@/lib/errors";

export async function buildCenterExcel(
  center: Center,
  records: Assignment[],
  includePending: boolean,
): Promise<{ buffer: Buffer; issues: ExportIssue[] }> {
  const mapping = await readMapping();
  if (!isMappingReady(mapping)) {
    throw new AppError(
      "Falta el mapeo de celdas. En Exportaciones indique la hoja y las celdas de la plantilla original. No se inventan coordenadas.",
    );
  }
  const workbook = await workbookFromTemplate();
  const { issues, written } = applyRecordsToWorkbook(workbook, mapping, center, records, includePending);
  const conflicts = issues.filter((issue) => issue.level === "conflict");
  if (conflicts.length > 0) {
    throw new AppError(conflicts.map((issue) => issue.message).join(" "));
  }
  if (written === 0) {
    const detail = issues.map((issue) => issue.message).join(" ");
    throw new AppError(detail || "No hay datos confirmados para exportar.");
  }
  const raw = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(raw), issues };
}
