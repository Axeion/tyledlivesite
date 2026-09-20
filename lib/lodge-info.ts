import type { Lodge, Prisma } from "@/generated/prisma/client";
import type { LodgeInfoInput } from "@/lib/validation";

/** Form fields that make up the editable lodge profile, in `lodgeInfoSchema` order. */
export const LODGE_INFO_KEYS = [
  "name", "number", "jurisdiction", "tagline", "about", "meetingSchedule", "contactEmail", "contactPhone", "website",
  "addressLine1", "addressLine2", "city", "region", "postalCode", "country", "timezone",
] as const;

const ADDRESS_KEYS = ["addressLine1", "addressLine2", "city", "region", "postalCode", "country"] as const;

/**
 * Builds the update for a lodge-profile edit. When any address field changed
 * the cached coordinates are cleared so the worker geocodes the new address;
 * the caller uses `addressChanged` to word its confirmation. Shared by the
 * lodge dashboard and the platform admin so both paths behave identically.
 */
export function applyLodgeInfo(lodge: Lodge, data: LodgeInfoInput): { data: Prisma.LodgeUpdateInput; addressChanged: boolean } {
  const addressChanged = ADDRESS_KEYS.some((k) => lodge[k] !== data[k]);
  return {
    data: { ...data, ...(addressChanged ? { lat: null, lng: null, geocodedAt: null } : {}) },
    addressChanged,
  };
}
