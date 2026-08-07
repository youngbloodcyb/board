import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageCrop, ImageCropApply, ImageCropContent, ImageCropReset } from ".";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ImageCrop", () => {
  it("applies the initial crop at the source image resolution", async () => {
    const drawImage = vi.fn();
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({ drawImage } as never);
    vi.spyOn(canvas, "toDataURL").mockReturnValue(
      "data:image/png;base64,cropped",
    );
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) =>
      tagName === "canvas" ? canvas : createElement(tagName),
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: async () => new Blob(["cropped"], { type: "image/png" }),
    } as Response);
    const onCrop = vi.fn();

    render(
      <ImageCrop file={new File(["image"], "photo.png")} onCrop={onCrop}>
        <ImageCropContent />
        <ImageCropApply>Apply</ImageCropApply>
      </ImageCrop>,
    );

    const image = await screen.findByAltText("crop");
    Object.defineProperties(image, {
      width: { configurable: true, value: 100 },
      height: { configurable: true, value: 80 },
      naturalWidth: { configurable: true, value: 1000 },
      naturalHeight: { configurable: true, value: 800 },
    });
    fireEvent.load(image);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onCrop).toHaveBeenCalledOnce());
    expect(canvas.width).toBe(900);
    expect(canvas.height).toBe(720);
    expect(drawImage).toHaveBeenCalledWith(
      image,
      50,
      40,
      900,
      720,
      0,
      0,
      900,
      720,
    );
  });

  it("can apply again after resetting the crop", async () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as never);
    vi.spyOn(canvas, "toDataURL").mockReturnValue(
      "data:image/png;base64,cropped",
    );
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) =>
      tagName === "canvas" ? canvas : createElement(tagName),
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: async () => new Blob(["cropped"], { type: "image/png" }),
    } as Response);
    const onCrop = vi.fn();

    render(
      <ImageCrop file={new File(["image"], "photo.png")} onCrop={onCrop}>
        <ImageCropContent />
        <ImageCropReset>Reset</ImageCropReset>
        <ImageCropApply>Apply</ImageCropApply>
      </ImageCrop>,
    );

    const image = await screen.findByAltText("crop");
    Object.defineProperties(image, {
      width: { configurable: true, value: 100 },
      height: { configurable: true, value: 80 },
      naturalWidth: { configurable: true, value: 1000 },
      naturalHeight: { configurable: true, value: 800 },
    });
    fireEvent.load(image);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(onCrop).toHaveBeenCalledOnce());
  });
});
