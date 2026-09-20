import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { applyLodgeInfo, LODGE_INFO_KEYS } from "@/lib/lodge-info";
import { lodgeInfoSchema } from "@/lib/validation";
import { makeLodge, resetDatabase } from "./helpers";
import type { Lodge } from "@/generated/prisma/client";

/** A lodge that has an address and has already been placed on the map. */
async function locatedLodge(): Promise<Lodge> {
  const lodge = await makeLodge();
  return db.lodge.update({
    where: { id: lodge.id },
    data: { addressLine1: "1 Temple St", city: "Springfield", region: "IL", postalCode: "62701", lat: 39.8, lng: -89.6, geocodedAt: new Date() },
  });
}

/** What a submitted profile form looks like for `lodge`, before any edits. */
function formFor(lodge: Lodge): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of LODGE_INFO_KEYS) {
    const v = lodge[key];
    out[key] = v === null || v === undefined ? undefined : String(v);
  }
  return out;
}

describe("applyLodgeInfo", () => {
  beforeEach(resetDatabase);

  it("keeps the map location when the address is untouched", async () => {
    const lodge = await locatedLodge();
    const { data, addressChanged } = applyLodgeInfo(lodge, lodgeInfoSchema.parse({ ...formFor(lodge), tagline: "New tagline" }));

    expect(addressChanged).toBe(false);
    expect(data.tagline).toBe("New tagline");
    expect(data).not.toHaveProperty("lat");
    expect(data).not.toHaveProperty("geocodedAt");
  });

  it("clears the cached coordinates when any address field changes", async () => {
    const lodge = await locatedLodge();
    const { data, addressChanged } = applyLodgeInfo(lodge, lodgeInfoSchema.parse({ ...formFor(lodge), city: "Shelbyville" }));

    expect(addressChanged).toBe(true);
    expect(data).toMatchObject({ city: "Shelbyville", lat: null, lng: null, geocodedAt: null });
  });

  it("treats a blank input and a null column as the same address", async () => {
    // Address line 2 is null in the database and blank in the form; that is not a move.
    const lodge = await locatedLodge();
    const { addressChanged } = applyLodgeInfo(lodge, lodgeInfoSchema.parse({ ...formFor(lodge), addressLine2: "" }));
    expect(addressChanged).toBe(false);
  });
});
