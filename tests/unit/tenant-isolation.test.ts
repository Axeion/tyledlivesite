import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TENANT_MODELS, TenantIsolationError, tenantDb } from "@/lib/tenant-db";
import { makeLodge, resetDatabase } from "./helpers";

describe("tenant-scoped database client", () => {
  beforeEach(resetDatabase);

  it("lists every schema model that carries a lodgeId", () => {
    const schema = readFileSync(path.resolve(__dirname, "../../prisma/schema.prisma"), "utf8");
    const models = [...schema.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)]
      .filter(([, , body]) => /^\s*lodgeId\s+String/m.test(body))
      .map(([, name]) => name)
      .sort();
    expect([...TENANT_MODELS].sort()).toEqual(models);
  });

  it("only returns rows belonging to the tenant", async () => {
    const a = await makeLodge();
    const b = await makeLodge();
    await db.officer.createMany({
      data: [
        { lodgeId: a.id, title: "Master", name: "A1" },
        { lodgeId: b.id, title: "Master", name: "B1" },
        { lodgeId: b.id, title: "Warden", name: "B2" },
      ],
    });
    const rowsA = await tenantDb(a.id).officer.findMany();
    const rowsB = await tenantDb(b.id).officer.findMany();
    expect(rowsA.map((r) => r.name)).toEqual(["A1"]);
    expect(rowsB.map((r) => r.name).sort()).toEqual(["B1", "B2"]);
    expect(await tenantDb(a.id).officer.count()).toBe(1);
  });

  it("cannot read another tenant's row by id", async () => {
    const a = await makeLodge();
    const b = await makeLodge();
    const foreign = await db.officer.create({ data: { lodgeId: b.id, title: "Master", name: "B" } });
    expect(await tenantDb(a.id).officer.findUnique({ where: { id: foreign.id } })).toBeNull();
    expect(await tenantDb(a.id).officer.findFirst({ where: { id: foreign.id } })).toBeNull();
    await expect(tenantDb(a.id).officer.findUniqueOrThrow({ where: { id: foreign.id } })).rejects.toThrow();
  });

  it("cannot update or delete another tenant's row", async () => {
    const a = await makeLodge();
    const b = await makeLodge();
    const foreign = await db.page.create({ data: { lodgeId: b.id, slug: "x", title: "B page", bodyHtml: "<p>b</p>" } });
    await expect(tenantDb(a.id).page.update({ where: { id: foreign.id }, data: { title: "hacked" } })).rejects.toThrow();
    await expect(tenantDb(a.id).page.delete({ where: { id: foreign.id } })).rejects.toThrow();
    const res = await tenantDb(a.id).page.updateMany({ where: { id: foreign.id }, data: { title: "hacked" } });
    expect(res.count).toBe(0);
    const del = await tenantDb(a.id).page.deleteMany({});
    expect(del.count).toBe(0);
    const still = await db.page.findUnique({ where: { id: foreign.id } });
    expect(still?.title).toBe("B page");
  });

  it("forces lodgeId on creates and rejects foreign lodgeId", async () => {
    const a = await makeLodge();
    const b = await makeLodge();
    const created = await tenantDb(a.id).event.create({
      data: { title: "Meeting", startsAt: new Date() },
    });
    expect(created.lodgeId).toBe(a.id);
    await expect(
      tenantDb(a.id).event.create({ data: { lodgeId: b.id, title: "Sneaky", startsAt: new Date() } }),
    ).rejects.toBeInstanceOf(TenantIsolationError);
    await expect(
      tenantDb(a.id).event.createMany({ data: [{ lodgeId: b.id, title: "Sneaky", startsAt: new Date() }] }),
    ).rejects.toBeInstanceOf(TenantIsolationError);
    expect(await db.event.count({ where: { lodgeId: b.id } })).toBe(0);
  });

  it("rejects where clauses that name a foreign lodgeId", async () => {
    const a = await makeLodge();
    const b = await makeLodge();
    await expect(tenantDb(a.id).officer.findMany({ where: { lodgeId: b.id } })).rejects.toBeInstanceOf(TenantIsolationError);
  });

  it("cannot move a row to another tenant via update", async () => {
    const a = await makeLodge();
    const b = await makeLodge();
    const own = await tenantDb(a.id).officer.create({ data: { title: "Master", name: "A" } });
    await expect(
      tenantDb(a.id).officer.update({ where: { id: own.id }, data: { lodgeId: b.id } }),
    ).rejects.toBeInstanceOf(TenantIsolationError);
  });

  it("scopes upsert to the tenant", async () => {
    const a = await makeLodge();
    const b = await makeLodge();
    await db.page.create({ data: { lodgeId: b.id, slug: "about", title: "B about", bodyHtml: "" } });
    const page = await tenantDb(a.id).page.upsert({
      where: { lodgeId_slug: { lodgeId: a.id, slug: "about" } },
      create: { slug: "about", title: "A about", bodyHtml: "" },
      update: { title: "A about updated" },
    });
    expect(page.lodgeId).toBe(a.id);
    expect(page.title).toBe("A about");
    expect(await db.page.count()).toBe(2);
  });

  it("restricts the Lodge model to the tenant's own row", async () => {
    const a = await makeLodge();
    const b = await makeLodge();
    const own = await tenantDb(a.id).lodge.findUnique({ where: { id: a.id } });
    expect(own?.id).toBe(a.id);
    await expect(tenantDb(a.id).lodge.findUnique({ where: { id: b.id } })).rejects.toBeInstanceOf(TenantIsolationError);
    const first = await tenantDb(a.id).lodge.findFirst({});
    expect(first?.id).toBe(a.id);
    const unsafe = tenantDb(a.id) as unknown as typeof db;
    await expect(unsafe.lodge.delete({ where: { id: a.id } })).rejects.toBeInstanceOf(TenantIsolationError);
    await expect(unsafe.lodge.findMany()).rejects.toBeInstanceOf(TenantIsolationError);
  });

  it("blocks platform-only models and raw SQL", async () => {
    const a = await makeLodge();
    const t = tenantDb(a.id);
    await expect((t as unknown as typeof db).user.findMany()).rejects.toBeInstanceOf(TenantIsolationError);
    await expect((t as unknown as typeof db).stripeEvent.findMany()).rejects.toBeInstanceOf(TenantIsolationError);
    expect(() => (t as unknown as typeof db).$queryRawUnsafe("select 1")).toThrow(TenantIsolationError);
    expect(() => (t as unknown as typeof db).$executeRawUnsafe("select 1")).toThrow(TenantIsolationError);
  });

  it("refuses an empty lodgeId", () => {
    expect(() => tenantDb("")).toThrow(TenantIsolationError);
  });
});
