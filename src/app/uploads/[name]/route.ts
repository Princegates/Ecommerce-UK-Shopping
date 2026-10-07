import { readImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** Serves a product photo uploaded in the admin. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const img = readImage((await params).name);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
