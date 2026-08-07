import { get } from "@vercel/blob";
import sharp from "sharp";

const MAX_IMAGE_DIMENSION = 4_096;

export type ImageEmbeddingInput = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
};

export async function loadImageEmbeddingInput(
  objectKey: string,
): Promise<ImageEmbeddingInput> {
  const result = await get(objectKey, { access: "private", useCache: false });
  if (!result?.stream) throw new Error("Image blob not found");

  const sourceBytes = Buffer.from(
    await new Response(result.stream).arrayBuffer(),
  );
  const image = sharp(sourceBytes, { animated: false }).rotate();
  const metadata = await image.metadata();
  const resized = image.resize({
    width: MAX_IMAGE_DIMENSION,
    height: MAX_IMAGE_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (metadata.hasAlpha) {
    return {
      bytes: await resized.png().toBuffer(),
      mimeType: "image/png",
    };
  }

  return {
    bytes: await resized.jpeg({ quality: 90 }).toBuffer(),
    mimeType: "image/jpeg",
  };
}
