"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { centerFormSchema, fieldErrors } from "@/lib/domain/schemas";
import { AppError, publicError } from "@/lib/errors";
import { createCenter, deleteCenter, updateCenter } from "@/lib/repositories/centers";

export type FormState = {
  message?: string;
  fieldErrors?: Record<string, string>;
};

function readCenterForm(formData: FormData) {
  const supervisorRaw = String(formData.get("supervisorCount") ?? "").trim();
  return centerFormSchema.safeParse({
    department: formData.get("department"),
    municipality: formData.get("municipality"),
    name: formData.get("name"),
    code: formData.get("code") ?? "",
    jrvCount: formData.get("jrvCount"),
    supervisorCount: supervisorRaw === "" ? null : supervisorRaw,
  });
}

function revalidateCenter(id?: string) {
  revalidatePath("/");
  revalidatePath("/centros");
  revalidatePath("/exportaciones");
  if (id) revalidatePath(`/centros/${id}`);
}

export async function createCenterAction(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = readCenterForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  try {
    const center = await createCenter(parsed.data);
    revalidateCenter(center.id);
    redirect(`/centros/${center.id}`);
  } catch (error) {
    unstable_rethrow(error);
    return { message: publicError(error, "No se pudo crear el centro.").message };
  }
}

export async function updateCenterAction(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = readCenterForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  try {
    await updateCenter(id, parsed.data);
    revalidateCenter(id);
    redirect(`/centros/${id}`);
  } catch (error) {
    unstable_rethrow(error);
    return { message: publicError(error, "No se pudo actualizar el centro.").message };
  }
}

export async function deleteCenterAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  try {
    await deleteCenter(id);
    revalidateCenter(id);
    redirect("/centros");
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) throw error;
    throw new AppError("No se pudo eliminar el centro.", 500);
  }
}
