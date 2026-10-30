import "server-only";

import { randomUUID } from "node:crypto";

import { recordSchema, type RecordFormInput } from "@/lib/domain/schemas";
import type { Assignment } from "@/lib/domain/types";
import { AppError } from "@/lib/errors";
import { getRedis, keys } from "@/lib/redis";
import { getCenter, refreshCenterStatus } from "@/lib/repositories/centers";

function parseRecord(value: unknown): Assignment | null {
  const parsed = recordSchema.safeParse(value);
  if (!parsed.success) return null;
  const { sourceImageId, ...rest } = parsed.data;
  return sourceImageId ? { ...rest, sourceImageId } : rest;
}

export async function listRecords(centerId: string): Promise<Assignment[]> {
  const redis = getRedis();
  const ids = await redis.smembers(keys.centerRecords(centerId));
  if (ids.length === 0) return [];
  const raw = await redis.mget<(unknown | null)[]>(...ids.map((id) => keys.record(id)));
  return raw
    .map((item) => parseRecord(item))
    .filter((item): item is Assignment => item !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getRecord(id: string): Promise<Assignment | null> {
  const raw = await getRedis().get<unknown>(keys.record(id));
  return parseRecord(raw);
}

export async function createRecord(input: RecordFormInput): Promise<Assignment> {
  const center = await getCenter(input.centerId);
  if (!center) throw new AppError("No se encontró el centro.", 404);
  const now = new Date().toISOString();
  const record: Assignment = {
    id: randomUUID(),
    centerId: input.centerId,
    role: input.role,
    reference: input.reference,
    assignmentType: input.assignmentType,
    name: input.name,
    dui: input.dui,
    phone: input.phone,
    observations: input.observations,
    reviewStatus: input.reviewStatus,
    createdAt: now,
    updatedAt: now,
    ...(input.sourceImageId ? { sourceImageId: input.sourceImageId } : {}),
  };
  const redis = getRedis();
  const pipe = redis.pipeline();
  pipe.set(keys.record(record.id), record);
  pipe.sadd(keys.centerRecords(record.centerId), record.id);
  await pipe.exec();
  await refreshCenterStatus(record.centerId);
  return record;
}

export async function updateRecord(id: string, input: RecordFormInput): Promise<Assignment> {
  const current = await getRecord(id);
  if (!current || current.centerId !== input.centerId) {
    throw new AppError("No se encontró el registro.", 404);
  }
  const record: Assignment = {
    ...current,
    role: input.role,
    reference: input.reference,
    assignmentType: input.assignmentType,
    name: input.name,
    dui: input.dui,
    phone: input.phone,
    observations: input.observations,
    reviewStatus: input.reviewStatus,
    updatedAt: new Date().toISOString(),
    ...(input.sourceImageId ? { sourceImageId: input.sourceImageId } : {}),
  };
  await getRedis().set(keys.record(id), record);
  await refreshCenterStatus(record.centerId);
  return record;
}

export async function deleteRecord(centerId: string, id: string): Promise<void> {
  const current = await getRecord(id);
  if (!current || current.centerId !== centerId) {
    throw new AppError("No se encontró el registro.", 404);
  }
  const redis = getRedis();
  const pipe = redis.pipeline();
  pipe.del(keys.record(id));
  pipe.srem(keys.centerRecords(centerId), id);
  await pipe.exec();
  await refreshCenterStatus(centerId);
}

export async function listAllRecords(centerIds: string[]): Promise<Assignment[]> {
  const groups = await Promise.all(centerIds.map((centerId) => listRecords(centerId)));
  return groups.flat();
}
