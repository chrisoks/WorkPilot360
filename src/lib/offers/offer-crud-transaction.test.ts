import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { runOfferCrudTransaction } from "./offer-crud-transaction";

describe("offer CRUD transaction", () => {
  it("locks the organization and number sequence before all creation writes", async () => {
    const events: string[] = [];
    const tx = {
      $executeRaw: vi.fn(async () => {
        events.push("lock");
        return 1;
      }),
    };
    const prisma = {
      $transaction: vi.fn(async (operation: (value: typeof tx) => Promise<string>) => {
        events.push("begin");
        const result = await operation(tx);
        events.push("commit");
        return result;
      }),
    };

    const result = await runOfferCrudTransaction({
      prisma: prisma as never,
      organizationId: "org-1",
      lockKey: "number",
      operation: async () => {
        events.push("number");
        events.push("header");
        events.push("lines");
        events.push("labor");
        events.push("history");
        return "saved";
      },
    });

    expect(result).toBe("saved");
    expect(events).toEqual(["begin", "lock", "number", "header", "lines", "labor", "history", "commit"]);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      maxWait: 5_000,
      timeout: 30_000,
    });
  });

  it("does not commit when replacing positions or labor rows fails", async () => {
    const tx = { $executeRaw: vi.fn(async () => 1) };
    let committed = false;
    const prisma = {
      $transaction: vi.fn(async (operation: (value: typeof tx) => Promise<unknown>) => {
        const result = await operation(tx);
        committed = true;
        return result;
      }),
    };

    await expect(
      runOfferCrudTransaction({
        prisma: prisma as never,
        organizationId: "org-1",
        lockKey: "offer:offer-1",
        operation: async () => {
          throw new Error("labor insert failed after old positions were deleted");
        },
      })
    ).rejects.toThrow("labor insert failed");

    expect(committed).toBe(false);
  });

  it("restarts the complete transaction after a serializable conflict", async () => {
    const tx = { $executeRaw: vi.fn(async () => 1) };
    let attempt = 0;
    const prisma = {
      $transaction: vi.fn(async (operation: (value: typeof tx) => Promise<string>) => {
        attempt += 1;
        if (attempt === 1) {
          throw new Prisma.PrismaClientKnownRequestError("write conflict", {
            code: "P2034",
            clientVersion: "test",
          });
        }
        return operation(tx);
      }),
    };

    await expect(runOfferCrudTransaction({
      prisma: prisma as never,
      organizationId: "org-1",
      lockKey: "number",
      operation: async () => "saved-after-retry",
    })).resolves.toBe("saved-after-retry");

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
