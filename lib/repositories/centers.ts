import "server-only";

import { randomUUID } from "node:crypto";

import { computeCenterStatus } from "@/lib/domain/progress";
import { centerSchema, type CenterFormInput } from "@/lib/domain/schemas";
import type { Assignment, Center } from "@/lib/domain/types";
import { AppError } from "@/lib/errors";
import { getRedis, keys } from "@/lib/redis";

function parseCenter(value: unknown): Center | null {
  const parsed = centerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function listCenters(): Promise<Center[]> {
  const redis = getRedis();
  const ids = await redis.smembers(keys.centers);
  if (ids.length === 0) return [];
  const raw = await redis.mget<(unknown | null)[]>(...ids.map((id) => keys.center(id)));
  return raw
    .map((item) => parseCenter(item))
    .filter((item): item is Center => item !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCenter(id: string): Promise<Center | null> {
  const raw = await getRedis().get<unknown>(keys.center(id));
  return parseCenter(raw);
}

export async function createCenter(input: CenterFormInput): Promise<Center> {
  const now = new Date().toISOString();
  const center: Center = {
    id: randomUUID(),
    department: input.department,
    municipality: input.municipality,
    name: input.name,
    code: input.code,
    jrvCount: input.jrvCount,
    supervisorCount: input.supervisorCount,
    createdAt: now,
    updatedAt: now,
    status: "PENDING",
  };
  const redis = getRedis();
  const pipe = redis.pipeline();
  pipe.set(keys.center(center.id), center);
  pipe.sadd(keys.centers, center.id);
  await pipe.exec();
  return center;
}

export async function updateCenter(id: string, input: CenterFormInput): Promise<Center> {
  const current = await getCenter(id);
  if (!current) throw new AppError("No se encontró el centro.", 404);
  const { listRecords } = await import("@/lib/repositories/records");
  const records = await listRecords(id);
  const next: Center = {
    ...current,
    department: input.department,
    municipality: input.municipality,
    name: input.name,
    code: input.code,
    jrvCount: input.jrvCount,
    supervisorCount: input.supervisorCount,
    updatedAt: new Date().toISOString(),
    status: computeCenterStatus(
      { jrvCount: input.jrvCount, supervisorCount: input.supervisorCount },
      records,
    ),
  };
  await getRedis().set(keys.center(id), next);
  return next;
}

export async function deleteCenter(id: string): Promise<void> {
  const redis = getRedis();
  const recordIds = await redis.smembers(keys.centerRecords(id));
  const imageIds = await redis.smembers(keys.centerImages(id));
  const pipe = redis.pipeline();
  for (const recordId of recordIds) pipe.del(keys.record(recordId));
  for (const imageId of imageIds) pipe.del(keys.image(imageId));
  pipe.del(keys.centerRecords(id));
  pipe.del(keys.centerImages(id));
  pipe.del(keys.center(id));
  pipe.srem(keys.centers, id);
  await pipe.exec();
}

export async function refreshCenterStatus(centerId: string, records?: Assignment[]): Promise<void> {
  const center = await getCenter(centerId);
  if (!center) return;
  const source = records ?? (await (await import("@/lib/repositories/records")).listRecords(centerId));
  const status = computeCenterStatus(center, source);
  if (status === center.status) {
    await getRedis().set(keys.center(centerId), { ...center, updatedAt: new Date().toISOString() });
    return;
  }
  await getRedis().set(keys.center(centerId), {
    ...center,
    status,
    updatedAt: new Date().toISOString(),
  });
}

export function filterCenters(centers: Center[], query: string): Center[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return centers;
  return centers.filter((center) =>
    [center.name, center.municipality, center.department, center.code]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}
