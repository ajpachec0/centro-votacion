import ExcelJS from "exceljs";

import { ASSIGNMENT_LABELS, ROLE_LABELS } from "@/lib/domain/roles";
import { slotKey } from "@/lib/domain/roles";
import type { Assignment, Center } from "@/lib/domain/types";
import type { ExcelMapping } from "@/lib/excel/types";

export type ExportIssue = {
  level: "conflict" | "unmapped" | "warning";
  message: string;
};

function writeText(sheet: ExcelJS.Worksheet, address: string | undefined, value: string) {
  if (!address) return;
  const cell = sheet.getCell(address);
  cell.value = value;
  cell.numFmt = "@";
}

function describeSlot(record: Pick<Assignment, "role" | "reference" | "assignmentType">): string {
  return `${ROLE_LABELS[record.role]} · ${record.reference} · ${ASSIGNMENT_LABELS[record.assignmentType]}`;
}

export function applyRecordsToWorkbook(
  workbook: ExcelJS.Workbook,
  mapping: ExcelMapping,
  center: Pick<Center, "name" | "department" | "municipality" | "code" | "jrvCount">,
  records: readonly Assignment[],
  includePending: boolean,
): { issues: ExportIssue[]; written: number } {
  const sheet = workbook.getWorksheet(mapping.sheet);
  if (!sheet) {
    return {
      issues: [
        {
          level: "conflict",
          message: `La hoja «${mapping.sheet}» no existe en la plantilla.`,
        },
      ],
      written: 0,
    };
  }

  const issues: ExportIssue[] = [];
  let written = 0;
  const header = mapping.header ?? {};
  writeText(sheet, header.centerName, center.name);
  writeText(sheet, header.department, center.department);
  writeText(sheet, header.municipality, center.municipality);
  writeText(sheet, header.code, center.code);
  writeText(sheet, header.jrvCount, String(center.jrvCount));

  const groups = new Map<string, Assignment[]>();
  for (const record of records) {
    if (record.reviewStatus === "PENDING" && !includePending) continue;
    const key = slotKey(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    const confirmed = group.filter((record) => record.reviewStatus === "CONFIRMED");
    const pending = group.filter((record) => record.reviewStatus === "PENDING");
    let chosen: Assignment | undefined;
    if (confirmed.length > 1) {
      issues.push({
        level: "conflict",
        message: `Hay más de un registro confirmado para ${describeSlot(confirmed[0])}.`,
      });
      continue;
    }
    if (confirmed.length === 1) {
      chosen = confirmed[0];
      if (pending.length > 0) {
        issues.push({
          level: "warning",
          message: `Se usó el confirmado y se omitió un pendiente de ${describeSlot(chosen)}.`,
        });
      }
    } else if (pending.length > 1) {
      issues.push({
        level: "conflict",
        message: `Hay más de un registro pendiente para ${describeSlot(pending[0])}.`,
      });
      continue;
    } else if (pending.length === 1) {
      chosen = pending[0];
    }
    if (!chosen) continue;

    const entry = mapping.entries.find(
      (item) =>
        item.role === chosen.role &&
        item.reference === chosen.reference &&
        item.assignmentType === chosen.assignmentType,
    );
    if (!entry) {
      issues.push({
        level: "unmapped",
        message: `No hay celdas configuradas para ${describeSlot(chosen)}.`,
      });
      continue;
    }
    writeText(sheet, entry.nameCell, chosen.name);
    writeText(sheet, entry.duiCell, chosen.dui);
    writeText(sheet, entry.phoneCell, chosen.phone);
    written += 1;
  }

  if (written === 0 && issues.every((issue) => issue.level !== "conflict" && issue.level !== "unmapped")) {
    issues.push({
      level: "warning",
      message: includePending
        ? "No hay registros para escribir en la plantilla."
        : "No hay registros confirmados para escribir en la plantilla.",
    });
  }

  return { issues, written };
}
