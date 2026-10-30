import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center gap-3 px-4">
      <h1 className="text-2xl font-semibold">No se encontró la página</h1>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Volver al inicio
      </Link>
    </main>
  );
}
