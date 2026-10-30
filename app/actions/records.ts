"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guard";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/domain/review";
import { fieldErrors, recordFormSchema } from "@/lib/domain/schemas";
import { IMAGE_STATUSES } from "@/lib/domain/types";
import { publicError } from "@/lib/errors";
import { saveImageMetadata } from "@/lib/repositories/images";
import { createRecord, deleteRecord, listRecords, updateRecord } from "@/lib/repositories/records";

export type RecordState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  warning?: string;
};

function readRecordForm(formData: FormData) {
  const sourceImageId = String(formData.get("sourceImageId") ?? "").trim();
  return recordFormSchema.safeParse({
    centerId: formData.get("centerId"),
    role: formData.get("role"),
    reference: formData.get("reference"),
    assignmentType: formData.get("assignmentType"),
    name: formData.get("name") ?? "",
    dui: formData.get("dui") ?? "",
    phone: formData.get("phone") ?? "",
    observations: formData.get("observations") ?? "",
    reviewStatus: formData.get("reviewStatus"),
    ...(sourceImageId ? { sourceImageId } : {}),
  });
}

async function duiWarning(centerId: string, dui: string, ignoreId?: string): Promise<string | undefined> {
  const normalized = dui.trim();
  if (!normalized) return undefined;
  const records = await listRecords(centerId);
  const match = records.some((record) => record.id !== ignoreId && record.dui.trim() === normalized);
  if (!match) return undefined;
  return "Ya existe otro registro con este DUI en el centro. Revíselo antes de darlo por bueno.";
}

export async function saveRecordAction(_state: RecordState, formData: FormData): Promise<RecordState> {
  await requireUser();
  const parsed = readRecordForm(formData);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrors(parsed.error), message: "Revise los campos marcados." };
  }
  const recordId = String(formData.get("id") ?? "").trim();
  try {
    const warning = await duiWarning(parsed.data.centerId, parsed.data.dui, recordId || undefined);
    if (recordId) await updateRecord(recordId, parsed.data);
    else await createRecord(parsed.data);
    revalidatePath(`/centros/${parsed.data.centerId}`);
    revalidatePath("/");
    return {
      ok: true,
      warning,
      message: parsed.data.reviewStatus === "CONFIRMED" ? "Registro confirmado." : "Registro guardado como pendiente.",
    };
  } catch (error) {
    return { ok: false, message: publicError(error, "No se pudo guardar el registro.").message };
  }
}

export async function deleteRecordAction(formData: FormData): Promise<void> {
  await requireUser();
  const centerId = String(formData.get("centerId") ?? "");
  const id = String(formData.get("id") ?? "");
  await deleteRecord(centerId, id);
  revalidatePath(`/centros/${centerId}`);
  revalidatePath("/");
}

const draftSchema = z.object({
  image: z.object({
    id: z.string().trim().min(8).max(80),
    originalFileName: z.string().trim().min(1).max(180),
    mimeType: z.enum(ALLOWED_IMAGE_TYPES),
    size: z.number().int().positive().max(MAX_IMAGE_BYTES),
    processingStatus: z.enum(IMAGE_STATUSES),
  }),
  drafts: z.array(recordFormSchema.omit({ centerId: true })).min(1).max(80),
});

export async function saveDraftsAction(centerId: string, payload: unknown): Promise<RecordState> {
  await requireUser();
  const parsed = draftSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: "Los datos reconocidos no pasaron la validación. Corrija rol, referencia y formatos." };
  }
  try {
    await saveImageMetadata({
      ...parsed.data.image,
      centerId,
      createdAt: new Date().toISOString(),
    });
    for (const draft of parsed.data.drafts) {
      await createRecord({ ...draft, centerId, sourceImageId: parsed.data.image.id });
    }
    revalidatePath(`/centros/${centerId}`);
    revalidatePath("/");
    return { ok: true, message: `Se guardaron ${parsed.data.drafts.length} registros para revisión o confirmación.` };
  } catch (error) {
    return { ok: false, message: publicError(error, "No se pudieron guardar los registros.").message };
  }
}
