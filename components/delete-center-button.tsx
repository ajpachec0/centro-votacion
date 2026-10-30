"use client";

import { useState } from "react";

import { deleteCenterAction } from "@/app/actions/centers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function DeleteCenterButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="destructive" className="h-10" />}>Eliminar centro</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar centro</DialogTitle>
          <DialogDescription>
            Se eliminarán «{name}» y todos sus registros. Las fotografías no están guardadas en el servidor.
          </DialogDescription>
        </DialogHeader>
        <form action={deleteCenterAction}>
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive">
              Eliminar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
