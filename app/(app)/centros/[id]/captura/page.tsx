import Link from "next/link";
import { notFound } from "next/navigation";

import { RecordForm } from "@/components/record-form";
import { RecordTable } from "@/components/record-table";
import { requireUser } from "@/lib/auth/guard";
import { ASSIGNMENT_TYPES, ROLES, type AssignmentType, type Role } from "@/lib/domain/types";
import { getCenter } from "@/lib/repositories/centers";
import { listRecords } from "@/lib/repositories/records";

export default async function CapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rol?: string; referencia?: string; tipo?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const center = await getCenter(id);
  if (!center) notFound();
  const records = await listRecords(center.id);
  const role = ROLES.find((item) => item === query.rol);
  const assignmentType = ASSIGNMENT_TYPES.find((item) => item === query.tipo);
  const initial =
    role && query.referencia && assignmentType
      ? { role: role as Role, reference: query.referencia, assignmentType: assignmentType as AssignmentType }
      : undefined;

  return (
    <div className="grid gap-6">
      <div>
        <Link href={`/centros/${center.id}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Volver a {center.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Captura manual</h1>
        <p className="text-sm text-muted-foreground">Use esta pantalla si la fotografía no se puede leer.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <RecordForm center={center} initial={initial} existingDui={records.map((record) => record.dui.trim()).filter(Boolean)} />
      </div>
      <RecordTable center={center} records={records} />
    </div>
  );
}
