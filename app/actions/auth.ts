"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { login, logout } from "@/lib/auth/guard";
import { AppError, publicError } from "@/lib/errors";

export type AuthState = {
  message?: string;
};

function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("from"));
  try {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    await login(password, ip);
  } catch (error) {
    const appError = publicError(error, "No se pudo iniciar sesión.");
    return { message: appError.message };
  }
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  try {
    await logout();
  } catch (error) {
    if (!(error instanceof AppError)) {
      redirect("/login");
    }
  }
  redirect("/login");
}
