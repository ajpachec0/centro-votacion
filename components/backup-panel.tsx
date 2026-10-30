"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadFromResponse } from "@/lib/download";

export function BackupPanel() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);

  async function downloadBackup() {
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/respaldo");
      await downloadFromResponse(response, "respaldo-centros.json");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo descargar el respaldo.");
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setMessage("");
    try {
      const backup = JSON.parse(await file.text()) as unknown;
      const response = await fetch("/api/respaldo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, backup }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo importar el respaldo.");
      setMessage(data.message ?? "Respaldo importado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo importar el respaldo.");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        El respaldo incluye centros, registros y metadatos de imágenes. No incluye las fotografías ni las credenciales.
      </p>
      <div>
        <Button type="button" className="h-10" onClick={() => void downloadBackup()}>
          Descargar respaldo JSON
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
        Confirmo que quiero actualizar los registros cuyos identificadores ya existan.
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Importar respaldo
        <input
          type="file"
          accept="application/json"
          disabled={!confirm}
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
