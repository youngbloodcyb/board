import { handleUpload } from "@vercel/blob/client";
import { requireUser } from "@/lib/auth-server";
import { MAX_UPLOAD_SIZE_BYTES } from "@/lib/upload-policy";

export async function POST(req: Request): Promise<Response> {
  const result = await handleUpload({
    request: req,
    body: await req.json(),
    onBeforeGenerateToken: async (pathname) => {
      const user = await requireUser();
      if (!pathname.startsWith(`${user.id}/`)) {
        throw new Error("Object key must be scoped to the authenticated user");
      }
      return {
        allowedContentTypes: ["image/*", "application/pdf"],
        maximumSizeInBytes: MAX_UPLOAD_SIZE_BYTES,
        addRandomSuffix: true,
        validUntil: Date.now() + 60 * 60 * 1000,
      };
    },
  });
  return Response.json(result);
}
