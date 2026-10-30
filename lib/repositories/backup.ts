import "server-only";

import { backupSchema } from "@/lib/domain/schemas";
import type { Assignment, Center, SourceImage } from "@/lib/domain/types";
import { AppError } from "@/lib/errors";
import { getRedis, keys } from "@/lib/redis";
import { listCenters, refreshCenterStatus } from "@/lib/repositories/centers";
import { listImages } from "@/lib/repositories/images";
import { listAllRecords } from "@/lib/repositories/records";

export async function exportBackup() {
  const centers = await listCenters();
  const records = await listAllRecords(centers.map((center) => center.id));
  const imageGroups = await Promise.all(centers.map((center) => listImages(center.id)));
  return {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    centers,
    records,
    images: imageGroups.flat(),
  };
}

export async function importBackup(payload: unknown): Promise<{ centers: number; records: number }> {
  const parsed = backupSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("El archivo de respaldo no tiene el formato esperado.");
  }
  const redis = getRedis();
  const pipe = redis.pipeline();
  for (const center of parsed.data.centers) {
    pipe.set(keys.center(center.id), center satisfies Center);
    pipe.sadd(keys.centers, center.id);
  }
  for (const record of parsed.data.records) {
    const stored: Assignment = record.sourceImageId
      ? { ...record, sourceImageId: record.sourceImageId }
      : {
          id: record.id,
          centerId: record.centerId,
          role: record.role,
          reference: record.reference,
          assignmentType: record.assignmentType,
          name: record.name,
          dui: record.dui,
          phone: record.phone,
          observations: record.observations,
          reviewStatus: record.reviewStatus,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
    pipe.set(keys.record(record.id), stored);
    pipe.sadd(keys.centerRecords(record.centerId), record.id);
  }
  for (const image of parsed.data.images) {
    pipe.set(keys.image(image.id), image satisfies SourceImage);
    pipe.sadd(keys.centerImages(image.centerId), image.id);
  }
  await pipe.exec();
  for (const center of parsed.data.centers) {
    await refreshCenterStatus(center.id);
  }
  return { centers: parsed.data.centers.length, records: parsed.data.records.length };
}
