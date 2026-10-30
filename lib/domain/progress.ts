import { expectedSlots, slotKey } from "@/lib/domain/roles";
import type { Assignment, Center, CenterStatus } from "@/lib/domain/types";

export type ProgressSummary = {
  required: number;
  requiredFilled: number;
  optional: number;
  optionalFilled: number;
  pendingRecords: number;
  duplicateConfirmed: boolean;
  percent: number;
};

export function confirmedSlotKeys(records: readonly Assignment[]): Set<string> {
  return new Set(
    records.filter((record) => record.reviewStatus === "CONFIRMED").map((record) => slotKey(record)),
  );
}

export function duplicateConfirmedIds(records: readonly Assignment[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const record of records) {
    if (record.reviewStatus !== "CONFIRMED") continue;
    const key = slotKey(record);
    const list = groups.get(key) ?? [];
    list.push(record.id);
    groups.set(key, list);
  }
  const duplicates = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length > 1) ids.forEach((id) => duplicates.add(id));
  }
  return duplicates;
}

export function duplicateDuiIds(records: readonly Assignment[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const record of records) {
    const dui = record.dui.trim();
    if (!dui) continue;
    const list = groups.get(dui) ?? [];
    list.push(record.id);
    groups.set(dui, list);
  }
  const duplicates = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length > 1) ids.forEach((id) => duplicates.add(id));
  }
  return duplicates;
}

export function progressSummary(
  center: Pick<Center, "jrvCount" | "supervisorCount">,
  records: readonly Assignment[],
): ProgressSummary {
  const slots = expectedSlots(center);
  const confirmed = confirmedSlotKeys(records);
  const required = slots.filter((slot) => slot.required);
  const optional = slots.filter((slot) => !slot.required);
  const requiredFilled = required.filter((slot) => confirmed.has(slotKey(slot))).length;
  const optionalFilled = optional.filter((slot) => confirmed.has(slotKey(slot))).length;
  const pendingRecords = records.filter((record) => record.reviewStatus === "PENDING").length;
  const duplicateConfirmed = duplicateConfirmedIds(records).size > 0;
  const percent = required.length === 0 ? 0 : Math.round((requiredFilled / required.length) * 100);

  return {
    required: required.length,
    requiredFilled,
    optional: optional.length,
    optionalFilled,
    pendingRecords,
    duplicateConfirmed,
    percent,
  };
}

export function computeCenterStatus(
  center: Pick<Center, "jrvCount" | "supervisorCount">,
  records: readonly Assignment[],
): CenterStatus {
  if (records.length === 0) return "PENDING";
  const summary = progressSummary(center, records);
  if (
    summary.required > 0 &&
    summary.requiredFilled === summary.required &&
    summary.pendingRecords === 0 &&
    !summary.duplicateConfirmed
  ) {
    return "COMPLETED";
  }
  return "IN_PROGRESS";
}
