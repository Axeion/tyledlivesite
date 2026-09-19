import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, UploadValidationError, newObjectKey, validateImageUpload } from "@/lib/storage";

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
// Minimal JPEG header + padding
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]), Buffer.alloc(64)]);
// RIFF....WEBPVP8
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(32)]);

describe("validateImageUpload", () => {
  it("accepts png, jpeg and webp by magic bytes", async () => {
    expect((await validateImageUpload(PNG)).ext).toBe("png");
    expect((await validateImageUpload(JPEG)).mime).toBe("image/jpeg");
    expect((await validateImageUpload(WEBP)).ext).toBe("webp");
  });

  it("rejects SVG, executables and text regardless of filename", async () => {
    await expect(validateImageUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'))).rejects.toBeInstanceOf(
      UploadValidationError,
    );
    await expect(validateImageUpload(Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100)]))).rejects.toBeInstanceOf(UploadValidationError);
    await expect(validateImageUpload(Buffer.from("just text"))).rejects.toBeInstanceOf(UploadValidationError);
    await expect(validateImageUpload(Buffer.from("GIF89a" + "\0".repeat(20)))).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("rejects empty and oversized files", async () => {
    await expect(validateImageUpload(Buffer.alloc(0))).rejects.toThrow(/empty/);
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
    await expect(validateImageUpload(big)).rejects.toThrow(/limit/);
  });

  it("generates unguessable, namespaced object keys", () => {
    const k1 = newObjectKey("lodge1", "gallery", "png");
    const k2 = newObjectKey("lodge1", "gallery", "png");
    expect(k1).toMatch(/^lodges\/lodge1\/gallery\/[a-f0-9]{32}\.png$/);
    expect(k1).not.toBe(k2);
  });
});
