import { db } from "@/lib/db";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * Models that carry a `lodgeId` column. Every query issued through a tenant
 * client against these models is forced to that tenant's `lodgeId` in both the
 * `where` filter and any `data` being written. A unit test asserts that this
 * list matches the schema, so adding a tenant model without listing it here
 * fails CI.
 */
export const TENANT_MODELS = [
  "Officer",
  "GalleryImage",
  "Page",
  "Event",
  "Domain",
  "LodgeMembership",
  "LoginToken",
  "AuditLog",
] as const;

export type TenantModel = (typeof TENANT_MODELS)[number];

const TENANT_MODEL_SET = new Set<string>(TENANT_MODELS);

/** Operations whose `where` argument must be scoped. */
const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** Operations that create rows and therefore need `lodgeId` in `data`. */
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn", "upsert"]);

const RAW_METHODS = ["$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe"] as const;

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantIsolationError";
  }
}

type AnyRecord = Record<string, unknown>;

function scopeWhere(where: unknown, lodgeId: string): AnyRecord {
  const w = (where ?? {}) as AnyRecord;
  if ("lodgeId" in w && w.lodgeId !== undefined && w.lodgeId !== lodgeId) {
    throw new TenantIsolationError("Query attempted to filter by a foreign lodgeId");
  }
  return { ...w, lodgeId };
}

function scopeData(data: unknown, lodgeId: string): unknown {
  if (Array.isArray(data)) return data.map((row) => scopeData(row, lodgeId));
  const d = (data ?? {}) as AnyRecord;
  if ("lodgeId" in d && d.lodgeId !== undefined && d.lodgeId !== lodgeId) {
    throw new TenantIsolationError("Write attempted to set a foreign lodgeId");
  }
  if ("lodge" in d) {
    throw new TenantIsolationError("Use lodgeId, not a nested lodge relation, in tenant writes");
  }
  return { ...d, lodgeId };
}

function scopeArgs(operation: string, args: AnyRecord, lodgeId: string): AnyRecord {
  const next: AnyRecord = { ...args };
  if (WHERE_OPS.has(operation)) {
    next.where = scopeWhere(next.where, lodgeId);
  }
  if (CREATE_OPS.has(operation)) {
    if (operation === "upsert") {
      next.create = scopeData(next.create, lodgeId);
      if (next.update && (next.update as AnyRecord).lodgeId !== undefined) {
        if ((next.update as AnyRecord).lodgeId !== lodgeId) {
          throw new TenantIsolationError("Write attempted to move a row to a foreign lodge");
        }
      }
    } else {
      next.data = scopeData(next.data, lodgeId);
    }
  }
  if ((operation === "update" || operation === "updateMany" || operation === "updateManyAndReturn") && next.data) {
    const d = next.data as AnyRecord;
    if (d.lodgeId !== undefined && d.lodgeId !== lodgeId) {
      throw new TenantIsolationError("Write attempted to move a row to a foreign lodge");
    }
  }
  return next;
}

function createScopedClient(base: PrismaClient, lodgeId: string) {
  if (!lodgeId || typeof lodgeId !== "string") {
    throw new TenantIsolationError("tenantDb requires a lodgeId");
  }
  const extended = base.$extends({
    name: `tenant:${lodgeId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model === "Lodge") {
            // A tenant may only read/update its own lodge row.
            if (!["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "update"].includes(operation)) {
              throw new TenantIsolationError(`Operation ${operation} on Lodge is not allowed from a tenant client`);
            }
            const a = { ...(args as AnyRecord) };
            const where = (a.where ?? {}) as AnyRecord;
            if (where.id !== undefined && where.id !== lodgeId) {
              throw new TenantIsolationError("Tenant client cannot address a foreign lodge");
            }
            a.where = { ...where, id: lodgeId };
            return query(a as typeof args);
          }
          if (TENANT_MODEL_SET.has(model)) {
            return query(scopeArgs(operation, args as AnyRecord, lodgeId) as typeof args);
          }
          throw new TenantIsolationError(`Model ${model} is not accessible from a tenant client`);
        },
      },
    },
  });

  // Raw SQL bypasses the extension, so make it unreachable from a tenant client.
  return new Proxy(extended, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && (RAW_METHODS as readonly string[]).includes(prop)) {
        return () => {
          throw new TenantIsolationError(`${prop} is not available on a tenant-scoped client`);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

// ---------------------------------------------------------------------------
// Types: the scoped client injects lodgeId at runtime, so create/upsert inputs
// must not require the lodge relation. Everything else keeps Prisma's types.
// ---------------------------------------------------------------------------

type ModelOps<M extends TenantModel> = Prisma.TypeMap["model"][M]["operations"];
type LooseData<D> = D extends unknown ? Omit<D, "lodgeId" | "lodge"> & { lodgeId?: string } : never;
type LooseArgs<A, K extends string> = Omit<A, K> & { [P in K]: P extends keyof A ? LooseData<A[P]> : never };

type TenantDelegate<M extends TenantModel> = Omit<
  PrismaClient[Uncapitalize<M>],
  "create" | "createMany" | "createManyAndReturn" | "upsert" | "fields"
> & {
  create(args: LooseArgs<ModelOps<M>["create"]["args"], "data">): Promise<ModelOps<M>["create"]["result"]>;
  createMany(args: LooseArgs<ModelOps<M>["createMany"]["args"], "data">): Promise<ModelOps<M>["createMany"]["result"]>;
  createManyAndReturn(
    args: LooseArgs<ModelOps<M>["createManyAndReturn"]["args"], "data">,
  ): Promise<ModelOps<M>["createManyAndReturn"]["result"]>;
  upsert(args: LooseArgs<ModelOps<M>["upsert"]["args"], "create">): Promise<ModelOps<M>["upsert"]["result"]>;
};

export type TenantDb = { [M in TenantModel as Uncapitalize<M>]: TenantDelegate<M> } & {
  lodge: Pick<PrismaClient["lodge"], "findUnique" | "findUniqueOrThrow" | "findFirst" | "findFirstOrThrow" | "update">;
};

/**
 * Returns a Prisma client that can only see and write rows belonging to
 * `lodgeId`. This is the only client dashboard and public-site code receives.
 */
export function tenantDb(lodgeId: string, base: PrismaClient = db): TenantDb {
  return createScopedClient(base, lodgeId) as unknown as TenantDb;
}
