export async function downloadFromResponse(response: Response, fallbackName: string): Promise<void> {
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || type.includes("application/json")) {
    const data = (await response.json().catch(() => ({}))) as { error?: string; failures?: string[] };
    const details = data.failures?.length ? ` ${data.failures.join(" ")}` : "";
    throw new Error(`${data.error ?? "No se pudo completar la descarga."}${details}`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = match?.[1] ?? fallbackName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
