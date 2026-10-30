import { notFound } from "next/navigation";

import { CenterForm } from "@/components/center-form";
import { requireUser } from "@/lib/auth/guard";
import { getCenter } from "@/lib/repositories/centers";

export default async function EditCenterPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const center = await getCenter(id);
  if (!center) notFound();
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold">Editar centro</h1>
      <div className="rounded-xl border border-border bg-card p-5">
        <CenterForm center={center} />
      </div>
    </div>
  );
}
