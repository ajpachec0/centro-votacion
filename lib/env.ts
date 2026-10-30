import { z } from "zod";

import { AppError } from "@/lib/errors";

const envSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.string().trim().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().trim().min(1),
  APP_AUTH_SECRET: z.string().trim().min(16, "APP_AUTH_SECRET debe tener al menos 16 caracteres."),
  APP_AUTH_PASSWORD: z.string().trim().min(8).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

function redisProductError(url: string): string | null {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "UPSTASH_REDIS_REST_URL no es una URL válida.";
  }
  if (hostname.startsWith("qstash")) {
    return "La URL corresponde a QStash, no a Redis. Este proyecto solo puede usar Upstash Redis con UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN.";
  }
  if (hostname.includes("vector")) {
    return "La URL parece de Upstash Vector, no de Redis. Hace falta la URL REST de una base Redis.";
  }
  return null;
}

export function readEnv(): AppEnv {
  const parsed = envSchema.safeParse({
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    APP_AUTH_SECRET: process.env.APP_AUTH_SECRET,
    APP_AUTH_PASSWORD: process.env.APP_AUTH_PASSWORD || undefined,
  });
  if (!parsed.success) {
    throw new AppError(
      "Faltan variables de entorno. Copie .env.example a .env.local y complete Redis y APP_AUTH_SECRET.",
      500,
    );
  }
  const productError = redisProductError(parsed.data.UPSTASH_REDIS_REST_URL);
  if (productError) throw new AppError(productError, 500);
  return parsed.data;
}

export function loginPassword(env: AppEnv): string {
  return env.APP_AUTH_PASSWORD || env.APP_AUTH_SECRET;
}
