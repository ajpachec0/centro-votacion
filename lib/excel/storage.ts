import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

function excelBytes(bytes: Buffer) {
  return bytes as unknown as Parameters<ExcelJS.Xlsx["load"]>[0];
}

import { excelMappingSchema, isMappingReady, type ExcelMapping, type SheetInspection } from "@/lib/excel/types";
import { AppError } from "@/lib/errors";

export const templatePath = path.join(process.cwd(), "data", "templates", "centro.xlsx");
export const mappingPath = path.join(process.cwd(), "data", "excel-mapping.json");

export async function readTemplateBuffer(): Promise<Buffer | null> {
  try {
    return await readFile(templatePath);
  } catch {
    return null;
  }
}

export async function saveTemplateFile(bytes: Buffer): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(excelBytes(bytes));
  } catch {
    throw new AppError("El archivo no es un Excel .xlsx válido.");
  }
  if (workbook.worksheets.length === 0) {
    throw new AppError("El Excel no contiene hojas.");
  }
  await mkdir(path.dirname(templatePath), { recursive: true });
  await writeFile(templatePath, bytes);
}

export async function readMapping(): Promise<ExcelMapping | null> {
  try {
    const raw = JSON.parse(await readFile(mappingPath, "utf8")) as unknown;
    const parsed = excelMappingSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("El archivo data/excel-mapping.json no es válido. Revise las celdas y vuelva a guardarlo.");
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return null;
  }
}

export async function saveMapping(mapping: ExcelMapping): Promise<void> {
  const parsed = excelMappingSchema.parse(mapping);
  if (!isMappingReady(parsed)) {
    throw new AppError("Indique la hoja y al menos una fila de celdas antes de guardar el mapeo.");
  }
  await mkdir(path.dirname(mappingPath), { recursive: true });
  await writeFile(mappingPath, JSON.stringify(parsed, null, 2), "utf8");
}

export async function inspectTemplate(): Promise<SheetInspection[]> {
  const bytes = await readTemplateBuffer();
  if (!bytes) {
    throw new AppError("Todavía no hay una plantilla. Súbala en Exportaciones o cópiela a data/templates/centro.xlsx.");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBytes(bytes));
  return workbook.worksheets.map((sheet) => {
    const cells: { address: string; value: string }[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cells.length >= 250) return;
        const value = cellValue(cell.value);
        if (value) cells.push({ address: cell.address, value: value.slice(0, 140) });
      });
    });
    return {
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      merges: [...(sheet.model.merges ?? [])].slice(0, 120),
      cells,
    };
  });
}

function cellValue(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text;
  if (typeof value === "object" && "result" in value && value.result !== undefined && value.result !== null) {
    return String(value.result);
  }
  return "";
}

export async function workbookFromTemplate(): Promise<ExcelJS.Workbook> {
  const bytes = await readTemplateBuffer();
  if (!bytes) {
    throw new AppError(
      "Falta la plantilla original. Súbala en Exportaciones. No se genera un Excel sustituto.",
    );
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBytes(bytes));
  return workbook;
}
