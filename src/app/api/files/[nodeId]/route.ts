import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type NodeData, nodes } from "@/db/schema";
import { getSession } from "@/lib/auth-server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const { nodeId } = await params;
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const rows = await db
    .select()
    .from(nodes)
    .where(eq(nodes.id, nodeId))
    .limit(1);
  const node = rows[0];
  if (!node || node.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const data = node.data as NodeData;
  let objectKey: string | undefined;
  let externalUrl: string | undefined;
  if (data.kind === "image" || data.kind === "pdf") {
    objectKey = data.objectKey;
    externalUrl = data.url;
  }
  if (!objectKey) {
    if (externalUrl) return Response.redirect(externalUrl, 302);
    return new Response("Not found", { status: 404 });
  }

  const ifNoneMatch = req.headers.get("if-none-match") ?? undefined;
  const result = await get(objectKey, {
    access: "private",
    ifNoneMatch,
  });
  if (!result) return new Response("Not found", { status: 404 });
  if (result.statusCode === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        "Cache-Control": "private, no-cache",
        ETag: result.blob.etag,
      },
    });
  }

  const headers = new Headers({
    "Content-Type": result.blob.contentType,
    "Content-Length": String(result.blob.size),
    "Cache-Control": "private, no-cache",
    "Content-Disposition": `inline; filename="${nodeId}"`,
  });
  if (result.blob.etag) headers.set("ETag", result.blob.etag);

  return new Response(result.stream as unknown as ReadableStream, { headers });
}
