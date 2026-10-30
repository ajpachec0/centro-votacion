import "server-only";

import { Redis } from "@upstash/redis";

import { readEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  try {
    const env = readEnv();
    client = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    return client;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("No se pudo preparar la conexión con Upstash Redis.", 500);
  }
}

export const keys = {
  centers: "cv:centers",
  center: (id: string) => `cv:center:${id}`,
  centerRecords: (id: string) => `cv:center:${id}:records`,
  record: (id: string) => `cv:record:${id}`,
  centerImages: (id: string) => `cv:center:${id}:images`,
  image: (id: string) => `cv:image:${id}`,
  session: (sid: string) => `cv:session:${sid}`,
  loginAttempts: (hash: string) => `cv:login:attempts:${hash}`,
};
