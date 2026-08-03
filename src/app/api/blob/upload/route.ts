import { handleUpload } from "@vercel/blob/client";
import { requireUser } from "@/lib/auth-server";

const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: Request) {
  return handleUpload({
    request: req,
    body: await req.json(),
    onBeforeGenerateToken: async (pathname) => {
      const user = await requireUser();
      if (!pathname.startsWith(`${user.id}/`)) {
        throw new Error("Object key must be scoped to the authenticated user");
      }
      return {
        allowedContentTypes: ["image/*", "application/pdf"],
        maximumSizeInBytes: MAX_SIZE,
        addRandomSuffix: true,
        validUntil: Date.now() + 60 * 60 * 1000,
      };
    },
  });
}
