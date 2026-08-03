import { describe, expect, it, vi } from "vitest";
import {
  allocateContactCustomerNumber,
  assertChangedContactCustomerNumberAvailable,
  ContactNumberConflictError,
} from "./customer-number-service";

function fakeTx(queryResults: unknown[][]) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockImplementation(() => Promise.resolve(queryResults.shift() ?? [])),
  };
}

describe("contact customer number service", () => {
  it("allocates from the numeric maximum under an advisory lock", async () => {
    const tx = fakeTx([[{ maximum: 7000101n }], []]);
    await expect(allocateContactCustomerNumber({ tx: tx as never, organizationId: "org-1" })).resolves.toBe("7000102");
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("rejects an already used requested number", async () => {
    const tx = fakeTx([[{ maximum: 7000101n }], [{ id: "contact-2" }]]);
    await expect(allocateContactCustomerNumber({ tx: tx as never, organizationId: "org-1", requestedNumber: "7000050" }))
      .rejects.toBeInstanceOf(ContactNumberConflictError);
  });

  it("keeps an unchanged historical duplicate editable but blocks a newly selected duplicate", async () => {
    const unchanged = fakeTx([]);
    await expect(assertChangedContactCustomerNumberAvailable({
      tx: unchanged as never,
      organizationId: "org-1",
      contactId: "contact-1",
      previousNumber: "7000050",
      nextNumber: "7000050",
    })).resolves.toBeUndefined();
    expect(unchanged.$queryRaw).not.toHaveBeenCalled();

    const changed = fakeTx([[{ id: "contact-2" }]]);
    await expect(assertChangedContactCustomerNumberAvailable({
      tx: changed as never,
      organizationId: "org-1",
      contactId: "contact-1",
      previousNumber: "7000050",
      nextNumber: "7000051",
    })).rejects.toBeInstanceOf(ContactNumberConflictError);
  });
});
