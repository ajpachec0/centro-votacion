import Link from "next/link";
import { notFound } from "next/navigation";

import { PhotoCapture } from "@/components/photo-capture";
import { requireUser } from "@/lib/auth/guard";
import { getCenter } from "@/lib/repositories/centers";

export default async function PhotosPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const center = await getCenter(id);
  if (!center) notFound();
  return (
    <div className="grid gap-4">
      <div>
        <Link href={`/centros/${center.id}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Volver a {center.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Fotografías</h1>
      </div>
      <PhotoCapture center={center} />
    </div>
  );
}
