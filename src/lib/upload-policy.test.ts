import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_SIZE_BYTES, uploadSizeError } from "@/lib/upload-policy";

describe("uploadSizeError", () => {
  it("allows files at the upload limit", () => {
    expect(
      uploadSizeError({ name: "photo.png", size: MAX_UPLOAD_SIZE_BYTES }),
    ).toBeNull();
  });

  it("returns a readable error above the upload limit", () => {
    expect(
      uploadSizeError({ name: "photo.png", size: MAX_UPLOAD_SIZE_BYTES + 1 }),
    ).toBe("photo.png is too large. The maximum upload size is 10 MB.");
  });
});
