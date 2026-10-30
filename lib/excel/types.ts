import { z } from "zod";

import { ASSIGNMENT_TYPES, ROLES } from "@/lib/domain/types";

export const CELL_PATTERN = /^[A-Z]{1,3}[1-9][0-9]{0,5}$/;

const cellSchema = z.string().trim().regex(CELL_PATTERN, "Use una celda como C12.");

const optionalCell = z
  .string()
  .trim()
  .refine((value) => value === "" || CELL_PATTERN.test(value), "Use una celda como C12.")
  .optional();

export const excelMappingSchema = z.object({
  sheet: z.string().trim().max(80),
  header: z
    .object({
      centerName: optionalCell,
      department: optionalCell,
      municipality: optionalCell,
      code: optionalCell,
      jrvCount: optionalCell,
    })
    .default({}),
  entries: z
    .array(
      z.object({
        role: z.enum(ROLES),
        reference: z.string().trim().min(1).max(80),
        assignmentType: z.enum(ASSIGNMENT_TYPES),
        nameCell: cellSchema,
        duiCell: cellSchema,
        phoneCell: cellSchema,
      }),
    )
    .max(2000)
    .default([]),
});

export type ExcelMapping = z.infer<typeof excelMappingSchema>;
export type MappingEntry = ExcelMapping["entries"][number];

export type SheetInspection = {
  name: string;
  rowCount: number;
  columnCount: number;
  merges: string[];
  cells: { address: string; value: string }[];
};

export function isMappingReady(mapping: ExcelMapping | null): mapping is ExcelMapping {
  return Boolean(mapping && mapping.sheet.trim() && mapping.entries.length > 0);
}
