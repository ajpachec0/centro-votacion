import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CenterSearch({ initial = "" }: { initial?: string }) {
  return (
    <form action="/centros" className="flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="q">
        Buscar centros
      </label>
      <Input
        id="q"
        name="q"
        defaultValue={initial}
        placeholder="Buscar por nombre, municipio o departamento"
        className="h-10 text-base md:text-base"
      />
      <Button type="submit" className="h-10 px-4">
        Buscar
      </Button>
    </form>
  );
}
