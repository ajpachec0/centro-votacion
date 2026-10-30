import type { AssignmentType, Role } from "@/lib/domain/types";

export const DUI_PATTERN = /^\d{8}-\d$/;
export const PHONE_PATTERN = /^\d{4}-\d{4}$/;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_TEMPLATE_BYTES = 15 * 1024 * 1024;

type ReviewInput = {
  name: string;
  dui: string;
  phone: string;
  role?: Role | "";
  reference?: string;
  assignmentType?: AssignmentType | "";
};

export function reviewWarnings(input: Pick<ReviewInput, "name" | "dui" | "phone">): string[] {
  const warnings: string[] = [];
  const name = input.name.trim();
  const dui = input.dui.trim();
  const phone = input.phone.trim();

  if (name.length < 3) {
    warnings.push("Falta el nombre o es demasiado corto.");
  }
  if (!DUI_PATTERN.test(dui)) {
    warnings.push(dui ? "El DUI no tiene el formato 00000000-0." : "Falta el DUI.");
  }
  if (!PHONE_PATTERN.test(phone)) {
    warnings.push(
      phone ? "El teléfono no tiene el formato 0000-0000." : "Falta el teléfono.",
    );
  }

  return warnings;
}

export function canConfirm(input: ReviewInput): boolean {
  return Boolean(
    input.role &&
      input.reference?.trim() &&
      input.assignmentType &&
      reviewWarnings(input).length === 0,
  );
}
