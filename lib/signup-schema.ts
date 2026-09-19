import { z } from "zod";
import { emailSchema, lodgeInfoSchema, passwordSchema, slugSchema } from "@/lib/validation";
import { isTemplateId } from "@/templates/registry";

export const signupSchema = z.object({
  account: z.object({
    name: z.string().trim().min(1, "Your name is required").max(120),
    email: emailSchema,
    password: passwordSchema,
  }),
  templateId: z.string().refine(isTemplateId, "Unknown template"),
  slug: slugSchema,
  lodge: lodgeInfoSchema,
});

export type SignupInput = z.input<typeof signupSchema>;
