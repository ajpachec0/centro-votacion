import { z } from "zod";

import { DUI_PATTERN, PHONE_PATTERN } from "@/lib/domain/review";
import {
  ASSIGNMENT_TYPES,
  CENTER_STATUSES,
  IMAGE_STATUSES,
  REVIEW_STATUSES,
  ROLES,
} from "@/lib/domain/types";

const idSchema = z.string().trim().min(8).max(80);

export const centerFormSchema = z.object({
  department: z.string().trim().min(2, "Indique el departamento.").max(80),
  municipality: z.string().trim().min(2, "Indique el municipio o distrito.").max(80),
  name: z.string().trim().min(2, "Indique el nombre del centro.").max(160),
  code: z.string().trim().max(40).default(""),
  jrvCount: z.coerce
    .number({ error: "Indique la cantidad de JRV." })
    .int("La cantidad de JRV debe ser un número entero.")
    .min(1, "El centro debe tener al menos una JRV.")
    .max(400, "La cantidad de JRV supera el máximo permitido."),
  supervisorCount: z
    .union([
      z.null(),
      z.coerce
        .number()
        .int("La cantidad de supervisores debe ser un número entero.")
        .min(0)
        .max(200),
    ])
    .default(null),
});

export const centerSchema = z.object({
  id: idSchema,
  department: z.string(),
  municipality: z.string(),
  name: z.string(),
  code: z.string().default(""),
  jrvCount: z.number().int(),
  supervisorCount: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(CENTER_STATUSES),
});

export const recordFormSchema = z
  .object({
    centerId: idSchema,
    role: z.enum(ROLES, { error: "Seleccione un rol." }),
    reference: z.string().trim().min(1, "Indique la referencia.").max(80),
    assignmentType: z.enum(ASSIGNMENT_TYPES, { error: "Seleccione titular o suplente." }),
    name: z.string().trim().max(160).default(""),
    dui: z.string().trim().max(20).default(""),
    phone: z.string().trim().max(20).default(""),
    observations: z.string().trim().max(500).default(""),
    reviewStatus: z.enum(REVIEW_STATUSES),
    sourceImageId: z.string().trim().min(8).max(80).optional(),
  })
  .superRefine((value, context) => {
    if (value.reviewStatus !== "CONFIRMED") return;
    if (value.name.trim().length < 3) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "Para confirmar, escriba el nombre completo.",
      });
    }
    if (!DUI_PATTERN.test(value.dui)) {
      context.addIssue({
        code: "custom",
        path: ["dui"],
        message: "Para confirmar, el DUI debe tener el formato 00000000-0.",
      });
    }
    if (!PHONE_PATTERN.test(value.phone)) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Para confirmar, el teléfono debe tener el formato 0000-0000.",
      });
    }
  });

export const recordSchema = z.object({
  id: idSchema,
  centerId: idSchema,
  role: z.enum(ROLES),
  reference: z.string(),
  assignmentType: z.enum(ASSIGNMENT_TYPES),
  name: z.string(),
  dui: z.string(),
  phone: z.string(),
  observations: z.string().default(""),
  sourceImageId: z.string().min(8).nullable().optional(),
  reviewStatus: z.enum(REVIEW_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const imageSchema = z.object({
  id: idSchema,
  centerId: idSchema,
  originalFileName: z.string().max(180),
  mimeType: z.string().max(80),
  size: z.number().int().nonnegative(),
  processingStatus: z.enum(IMAGE_STATUSES),
  createdAt: z.string(),
});

export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  centers: z.array(centerSchema),
  records: z.array(recordSchema),
  images: z.array(imageSchema),
});

export type CenterFormInput = z.infer<typeof centerFormSchema>;
export type RecordFormInput = z.infer<typeof recordFormSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fields[key]) fields[key] = issue.message;
  }
  return fields;
}
