import "server-only";

import { imageSchema } from "@/lib/domain/schemas";
import type { SourceImage } from "@/lib/domain/types";
import { AppError } from "@/lib/errors";
import { getRedis, keys } from "@/lib/redis";
import { getCenter } from "@/lib/repositories/centers";

function parseImage(value: unknown): SourceImage | null {
  const parsed = imageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function listImages(centerId: string): Promise<SourceImage[]> {
  const redis = getRedis();
  const ids = await redis.smembers(keys.centerImages(centerId));
  if (ids.length === 0) return [];
  const raw = await redis.mget<(unknown | null)[]>(...ids.map((id) => keys.image(id)));
  return raw
    .map((item) => parseImage(item))
    .filter((item): item is SourceImage => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveImageMetadata(image: SourceImage): Promise<void> {
  const center = await getCenter(image.centerId);
  if (!center) throw new AppError("No se encontró el centro.", 404);
  const parsed = imageSchema.parse(image);
  const redis = getRedis();
  const pipe = redis.pipeline();
  pipe.set(keys.image(parsed.id), parsed);
  pipe.sadd(keys.centerImages(parsed.centerId), parsed.id);
  await pipe.exec();
}
