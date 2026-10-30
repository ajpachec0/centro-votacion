import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { excelFileName } from "@/lib/domain/filenames";
import { computeCenterStatus, progressSummary } from "@/lib/domain/progress";
import { canConfirm } from "@/lib/domain/review";
import { expectedSlots, supervisorQuota } from "@/lib/domain/roles";
import { recordFormSchema } from "@/lib/domain/schemas";
import type { Assignment, Center } from "@/lib/domain/types";
import { applyRecordsToWorkbook } from "@/lib/excel/fill";
import { normalizeDui, normalizePhone, parseOcrLines } from "@/lib/ocr/parse";

function center(jrvCount: number, supervisorCount: number | null = null): Pick<Center, "jrvCount" | "supervisorCount"> {
  return { jrvCount, supervisorCount };
}

function record(partial: Partial<Assignment> & Pick<Assignment, "role" | "reference" | "assignmentType">): Assignment {
  return {
    id: partial.id ?? "record-1",
    centerId: "center-1",
    name: partial.name ?? "NOMBRE DE EJEMPLO",
    dui: partial.dui ?? "00000000-0",
    phone: partial.phone ?? "0000-0000",
    observations: "",
    reviewStatus: partial.reviewStatus ?? "CONFIRMED",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("puestos esperados", () => {
  it("calcula supervisores con el entero superior de JRV / 7", () => {
    expect(supervisorQuota(1, null)).toBe(1);
    expect(supervisorQuota(7, null)).toBe(1);
    expect(supervisorQuota(8, null)).toBe(2);
    expect(supervisorQuota(8, 4)).toBe(4);
  });

  it("arma los puestos requeridos según la cantidad de JRV", () => {
    const slots = expectedSlots(center(1));
    const required = slots.filter((slot) => slot.required);
    expect(required.map((slot) => `${slot.role}:${slot.reference}:${slot.assignmentType}`)).toEqual([
      "JEFE_CENTRO:General:TITULAR",
      "DELEGADO_JEM:General:TITULAR",
      "SUPERVISOR:Supervisor 1:TITULAR",
      "ORIENTADOR:Orientador 1:TITULAR",
      "ORIENTADOR:Orientador 2:TITULAR",
      "MIEMBRO_MESA:JRV 1:TITULAR",
      "VIGILANTE:JRV 1:TITULAR",
    ]);
    expect(slots.some((slot) => slot.role === "VIGILANTE" && slot.assignmentType === "SUPLENTE" && !slot.required)).toBe(true);
    expect(expectedSlots(center(8)).filter((slot) => slot.role === "SUPERVISOR" && slot.required)).toHaveLength(2);
  });
});

describe("estado del centro", () => {
  it("permanece pendiente sin registros y no confirma datos incompletos", () => {
    expect(computeCenterStatus(center(1), [])).toBe("PENDING");
    expect(canConfirm({ name: "NOMBRE DE EJEMPLO", dui: "0000000-0", phone: "0000-0000", role: "VIGILANTE", reference: "JRV 1", assignmentType: "TITULAR" })).toBe(false);
    expect(canConfirm({ name: "NOMBRE DE EJEMPLO", dui: "00000000-0", phone: "0000-0000", role: "VIGILANTE", reference: "JRV 1", assignmentType: "TITULAR" })).toBe(true);
  });

  it("marca completado solo cuando los puestos requeridos están confirmados", () => {
    const slots = expectedSlots(center(1)).filter((slot) => slot.required);
    const records = slots.map((slot, index) =>
      record({ id: `r-${index}`, role: slot.role, reference: slot.reference, assignmentType: slot.assignmentType }),
    );
    expect(progressSummary(center(1), records).percent).toBe(100);
    expect(computeCenterStatus(center(1), records)).toBe("COMPLETED");
    records[0] = { ...records[0], reviewStatus: "PENDING" };
    expect(computeCenterStatus(center(1), records)).toBe("IN_PROGRESS");
  });
});

describe("formatos de texto", () => {
  it("conserva ceros iniciales y no completa dígitos faltantes", () => {
    const parsed = recordFormSchema.parse({
      centerId: "center-0001",
      role: "VIGILANTE",
      reference: "JRV 1",
      assignmentType: "TITULAR",
      name: "NOMBRE DE EJEMPLO",
      dui: "00000000-0",
      phone: "0000-0000",
      reviewStatus: "CONFIRMED",
    });
    expect(parsed.dui).toBe("00000000-0");
    expect(parsed.phone).toBe("0000-0000");
    expect(typeof parsed.dui).toBe("string");
    expect(normalizeDui("12345")).toBe("12345");
    expect(normalizeDui("000000000")).toBe("00000000-0");
    expect(normalizePhone("00000000")).toBe("0000-0000");
    expect(excelFileName({ municipality: "San Salvador", name: "Centro Él Árbol" })).toBe("san-salvador-centro-el-arbol.xlsx");
  });
});

describe("lectura del texto reconocido", () => {
  it("clasifica un bloque con encabezado y no inventa campos ausentes", () => {
    const [draft] = parseOcrLines([
      "Vigilante JRV 3 Propietario",
      "NOMBRE DE EJEMPLO",
      "DUI 00000000-0",
      "Tel 0000-0000",
    ]);
    expect(draft).toMatchObject({
      role: "VIGILANTE",
      reference: "JRV 3",
      assignmentType: "TITULAR",
      name: "NOMBRE DE EJEMPLO",
      dui: "00000000-0",
      phone: "0000-0000",
    });

    const empty = parseOcrLines(["Vigilante JRV 1 Suplente"]);
    expect(empty[0]?.name).toBe("");
    expect(empty[0]?.dui).toBe("");
    expect(empty[0]?.assignmentType).toBe("SUPLENTE");
    expect(empty[0]?.unrecognizedFields).toContain("nombre");
  });

  it("separa dos orientadores reconocidos en la misma imagen", () => {
    const drafts = parseOcrLines(["Orientador 1", "NOMBRE DE EJEMPLO", "Orientador 2", "OTRO NOMBRE"]);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.reference).toBe("Orientador 1");
    expect(drafts[1]?.reference).toBe("Orientador 2");
    expect(drafts[1]?.name).toBe("OTRO NOMBRE");
  });
});

describe("excel", () => {
  it("escribe DUI y teléfono como texto y omite pendientes", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Datos");
    const mapping = {
      sheet: "Datos",
      header: { centerName: "A1" },
      entries: [
        {
          role: "VIGILANTE" as const,
          reference: "JRV 1",
          assignmentType: "TITULAR" as const,
          nameCell: "B2",
          duiCell: "C2",
          phoneCell: "D2",
        },
      ],
    };
    const confirmed = record({
      role: "VIGILANTE",
      reference: "JRV 1",
      assignmentType: "TITULAR",
      dui: "00000000-0",
      phone: "0000-0000",
    });
    const pending = record({
      id: "record-2",
      role: "MIEMBRO_MESA",
      reference: "JRV 1",
      assignmentType: "TITULAR",
      reviewStatus: "PENDING",
      name: "PENDIENTE EJEMPLO",
    });
    const result = applyRecordsToWorkbook(
      workbook,
      mapping,
      { name: "Centro ejemplo", department: "San Salvador", municipality: "Ejemplo", code: "", jrvCount: 1 },
      [confirmed, pending],
      false,
    );
    const sheet = workbook.getWorksheet("Datos");
    expect(result.written).toBe(1);
    expect(sheet?.getCell("C2").value).toBe("00000000-0");
    expect(sheet?.getCell("C2").numFmt).toBe("@");
    expect(sheet?.getCell("A1").value).toBe("Centro ejemplo");
    expect(result.issues.some((issue) => issue.message.includes("PENDIENTE"))).toBe(false);
  });

  it("no elige entre dos confirmados del mismo puesto", () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Datos");
    const result = applyRecordsToWorkbook(
      workbook,
      {
        sheet: "Datos",
        header: {},
        entries: [
          {
            role: "VIGILANTE",
            reference: "JRV 1",
            assignmentType: "TITULAR",
            nameCell: "A2",
            duiCell: "B2",
            phoneCell: "C2",
          },
        ],
      },
      { name: "Centro ejemplo", department: "San Salvador", municipality: "Ejemplo", code: "", jrvCount: 1 },
      [
        record({ id: "a", role: "VIGILANTE", reference: "JRV 1", assignmentType: "TITULAR", name: "NOMBRE UNO" }),
        record({ id: "b", role: "VIGILANTE", reference: "JRV 1", assignmentType: "TITULAR", name: "NOMBRE DOS" }),
      ],
      false,
    );
    expect(result.written).toBe(0);
    expect(result.issues.some((issue) => issue.level === "conflict")).toBe(true);
    expect(workbook.getWorksheet("Datos")?.getCell("A2").value).toBeNull();
  });
});
