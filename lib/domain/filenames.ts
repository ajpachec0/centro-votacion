import type { Center } from "@/lib/domain/types";

export function safeFileStem(value: string): string {
  const folded = value.normalize("NFD").replace(/\p{M}/gu, "");
  const slug = folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "centro";
}

export function excelFileName(center: Pick<Center, "municipality" | "name">): string {
  return `${safeFileStem(`${center.municipality}-${center.name}`)}.xlsx`;
}
