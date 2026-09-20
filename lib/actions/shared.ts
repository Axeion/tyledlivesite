import { z } from "zod";
import { DomainValidationError } from "@/lib/domains/instructions";
import { RecurrenceError } from "@/lib/events/recurrence";
import { UploadValidationError } from "@/lib/storage";
import { formString, zodMessage } from "@/lib/validation";
import type { ActionResult } from "@/components/ActionForm";

/**
 * Helpers shared by the server-action modules. This file deliberately has no
 * "use server" directive: everything exported from such a file becomes a
 * callable endpoint, and these are plain functions.
 */

/** Turns a thrown error into the inline message an ActionForm displays. */
export function fail(err: unknown): ActionResult {
  if (err instanceof z.ZodError) return { error: zodMessage(err) };
  if (err instanceof DomainValidationError || err instanceof UploadValidationError || err instanceof RecurrenceError) {
    return { error: err.message };
  }
  if (err && typeof err === "object" && "digest" in err) throw err; // Next redirect/notFound
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

export function fromForm(fd: FormData, keys: readonly string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) out[k] = formString(fd, k);
  return out;
}
