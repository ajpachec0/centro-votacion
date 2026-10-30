import { BackupPanel } from "@/components/backup-panel";
import { requireUser } from "@/lib/auth/guard";

export default async function BackupPage() {
  await requireUser();
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Respaldo</h1>
        <p className="text-sm text-muted-foreground">Exporte o restaure los datos guardados en Redis.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <BackupPanel />
      </div>
    </div>
  );
}
