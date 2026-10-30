"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { excelMappingSchema } from "@/lib/excel/types";
import { saveMapping, saveTemplateFile } from "@/lib/excel/storage";
import { MAX_TEMPLATE_BYTES } from "@/lib/domain/review";
import { publicError } from "@/lib/errors";

export type TemplateState = {
  ok: boolean;
  message?: string;
};

export async function uploadTemplateAction(_state: TemplateState, formData: FormData): Promise<TemplateState> {
  await requireUser();
  const file = formData.get("template");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Seleccione el archivo .xlsx original." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, message: "La plantilla debe ser un archivo .xlsx." };
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    return { ok: false, message: "La plantilla supera el tamaño máximo de 15 MB." };
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await saveTemplateFile(bytes);
    revalidatePath("/exportaciones");
    return {
      ok: true,
      message: "Plantilla copiada en este equipo. El archivo original no se modifica. Falta indicar las celdas.",
    };
  } catch (error) {
    return { ok: false, message: publicError(error, "No se pudo leer la plantilla.").message };
  }
}

export async function saveMappingAction(_state: TemplateState, formData: FormData): Promise<TemplateState> {
  await requireUser();
  try {
    const raw = JSON.parse(String(formData.get("mapping") ?? "")) as unknown;
    const parsed = excelMappingSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "El mapeo no es válido. Revise la hoja y las direcciones de celda." };
    }
    await saveMapping(parsed.data);
    revalidatePath("/exportaciones");
    return { ok: true, message: "Mapeo guardado. La exportación usará esas celdas." };
  } catch (error) {
    return { ok: false, message: publicError(error, "No se pudo guardar el mapeo.").message };
  }
}
