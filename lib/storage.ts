import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Allowed image types by sniffed MIME. SVG is deliberately excluded (can carry scripts). */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export interface ValidatedImage {
  buffer: Buffer;
  mime: string;
  ext: string;
}

/**
 * Validates an uploaded image by size and by sniffing magic bytes. The
 * client-provided content type and filename are ignored on purpose.
 */
export async function validateImageUpload(input: Buffer | Uint8Array | ArrayBuffer): Promise<ValidatedImage> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input as ArrayBuffer);
  if (buffer.length === 0) throw new UploadValidationError("File is empty");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new UploadValidationError(`File exceeds ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB limit`);
  }
  const sniffed = await fileTypeFromBuffer(buffer);
  if (!sniffed || !ALLOWED_IMAGE_TYPES[sniffed.mime]) {
    throw new UploadValidationError("Only PNG, JPEG and WebP images are allowed");
  }
  return { buffer, mime: sniffed.mime, ext: ALLOWED_IMAGE_TYPES[sniffed.mime] };
}

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.s3.endpoint,
      region: env.s3.region,
      forcePathStyle: env.s3.forcePathStyle,
      credentials: { accessKeyId: env.s3.accessKey, secretAccessKey: env.s3.secretKey },
    });
  }
  return client;
}

/** Object keys are random and namespaced by lodge so they cannot be guessed or collide. */
export function newObjectKey(lodgeId: string, kind: "logo" | "seal" | "gallery", ext: string): string {
  return `lodges/${lodgeId}/${kind}/${randomBytes(16).toString("hex")}.${ext}`;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
}

export function publicUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `${env.s3.publicUrl}/${key}`;
}
