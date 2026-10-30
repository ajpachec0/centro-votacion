"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { deleteRecordAction } from "@/app/actions/records";
import { RecordForm } from "@/components/record-form";
import { ReviewBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { duplicateConfirmedIds, duplicateDuiIds } from "@/lib/domain/progress";
import { ASSIGNMENT_LABELS, ROLE_LABELS } from "@/lib/domain/roles";
import type { Assignment, Center } from "@/lib/domain/types";

export function RecordTable({ center, records }: { center: Center; records: Assignment[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [removing, setRemoving] = useState<Assignment | null>(null);
  const duplicateSlots = duplicateConfirmedIds(records);
  const duplicateDui = duplicateDuiIds(records);

  async function remove() {
    if (!removing) return;
    const formData = new FormData();
    formData.set("centerId", center.id);
    formData.set("id", removing.id);
    await deleteRecordAction(formData);
    setRemoving(null);
    router.refresh();
  }

  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay personas registradas en este centro.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rol</TableHead>
            <TableHead>Referencia</TableHead>
            <TableHead>Asignación</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>DUI</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell>{ROLE_LABELS[record.role]}</TableCell>
              <TableCell>{record.reference}</TableCell>
              <TableCell>{ASSIGNMENT_LABELS[record.assignmentType]}</TableCell>
              <TableCell>{record.name || "—"}</TableCell>
              <TableCell className="font-mono">
                {record.dui || "—"}
                {duplicateDui.has(record.id) ? <span className="mt-1 block text-xs text-warning">DUI repetido</span> : null}
              </TableCell>
              <TableCell className="font-mono">{record.phone || "—"}</TableCell>
              <TableCell>
                <ReviewBadge status={record.reviewStatus} />
                {duplicateSlots.has(record.id) ? (
                  <span className="mt-1 block text-xs text-warning">Puesto duplicado</span>
                ) : null}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="h-8" onClick={() => setEditing(record)}>
                    Editar
                  </Button>
                  <Button type="button" variant="destructive" className="h-8" onClick={() => setRemoving(record)}>
                    Eliminar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
            <DialogDescription>Los cambios se guardan solo cuando usted lo confirma.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <RecordForm
              center={center}
              record={editing}
              existingDui={records.filter((item) => item.id !== editing.id).map((item) => item.dui.trim())}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar registro</DialogTitle>
            <DialogDescription>
              Se eliminará el registro de {removing?.reference}. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void remove()}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
