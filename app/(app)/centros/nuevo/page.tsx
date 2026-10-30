import { CenterForm } from "@/components/center-form";
import { requireUser } from "@/lib/auth/guard";

export default async function NewCenterPage() {
  await requireUser();
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo centro</h1>
        <p className="text-sm text-muted-foreground">Los puestos se calculan a partir de la cantidad de JRV.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <CenterForm />
      </div>
    </div>
  );
}
