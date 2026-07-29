import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createQuote, createRevision, deleteDraftRevision, finalizeQuote, saveQuoteRevision } from "@/lib/quotes";

const testEmail = `quote-test-${Date.now()}@quoteflow.local`;
let userId = "";

beforeAll(async () => {
  const user = await db.user.create({ data: { email: testEmail, passwordHash: "test", displayName: "Quote Test", piPrefix: `T${Date.now().toString().slice(-6)}`, role: UserRole.SALESPERSON } });
  userId = user.id;
});

afterAll(async () => {
  await db.quoteSeries.deleteMany({ where: { salespersonId: userId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

describe("quote lifecycle", () => {
  it("allocates unique same-day PI numbers under concurrency", async () => {
    const user = { id: userId, email: testEmail, displayName: "Quote Test", piPrefix: `T${Date.now().toString().slice(-6)}`, role: UserRole.SALESPERSON };
    await db.user.update({ where: { id: userId }, data: { piPrefix: user.piPrefix } });
    const series = await Promise.all(Array.from({ length: 6 }, () => createQuote(user)));
    expect(new Set(series.map((item) => item.basePiNumber)).size).toBe(6);
  });

  it("locks finalized revisions and clones them as R02", async () => {
    const stored = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const user = { id: stored.id, email: stored.email, displayName: stored.displayName, piPrefix: stored.piPrefix, role: stored.role };
    const series = await createQuote(user);
    const first = series.revisions[0];
    await saveQuoteRevision(first.id, user, { shippingFee: 5, items: [{ productId: null, pnSnapshot: "TEST-1", nameSnapshot: "Test", descriptionSnapshot: "Test product", unitSnapshot: "pcs", imagePathSnapshot: null, quantity: 3, unitPrice: 2.5 }] });
    await finalizeQuote(first.id, user);
    await expect(saveQuoteRevision(first.id, user, { shippingFee: 0, items: [] })).rejects.toThrow("不能修改");
    const second = await createRevision(first.id, user);
    expect(second.displayPiNumber).toBe(`${series.basePiNumber}-R02`);
    expect(second.status).toBe("DRAFT");
  });

  it("allocates monotonic revisions under concurrency and never reuses a deleted number", async () => {
    const stored = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const user = { id: stored.id, email: stored.email, displayName: stored.displayName, piPrefix: stored.piPrefix, role: stored.role };
    const series = await createQuote(user);
    const first = series.revisions[0];
    await saveQuoteRevision(first.id, user, { shippingFee: 0, items: [{ productId: null, pnSnapshot: "REVISION-LOCK", nameSnapshot: null, descriptionSnapshot: "Revision test", unitSnapshot: "pcs", imagePathSnapshot: null, quantity: 1, unitPrice: 1 }] });
    await finalizeQuote(first.id, user);
    const revisions = await Promise.all([createRevision(first.id, user), createRevision(first.id, user)]);
    expect(revisions.map((item) => item.revisionNumber).sort()).toEqual([2, 3]);
    const r03 = revisions.find((item) => item.revisionNumber === 3)!;
    await deleteDraftRevision(r03.id, user);
    const next = await createRevision(first.id, user);
    expect(next.revisionNumber).toBe(4);
  });

  it("deletes an owned draft and its empty series", async () => {
    const stored = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const user = { id: stored.id, email: stored.email, displayName: stored.displayName, piPrefix: stored.piPrefix, role: stored.role };
    const series = await createQuote(user);
    const draft = series.revisions[0];
    await expect(deleteDraftRevision(draft.id, user)).resolves.toEqual({ deletedSeries: true });
    await expect(db.quoteSeries.findUnique({ where: { id: series.id } })).resolves.toBeNull();
  });

  it("rejects unauthorized deletion and allows deleting a finalized revision", async () => {
    const stored = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const user = { id: stored.id, email: stored.email, displayName: stored.displayName, piPrefix: stored.piPrefix, role: stored.role };
    const series = await createQuote(user);
    const draft = series.revisions[0];
    const stranger = { ...user, id: "not-the-owner" };
    await expect(deleteDraftRevision(draft.id, stranger)).rejects.toThrow("报价不存在");
    await saveQuoteRevision(draft.id, user, { shippingFee: 0, items: [{ productId: null, pnSnapshot: "DELETE-LOCK", nameSnapshot: null, descriptionSnapshot: "Locked", unitSnapshot: "pcs", imagePathSnapshot: null, quantity: 1, unitPrice: 1 }] });
    await finalizeQuote(draft.id, user);
    await expect(deleteDraftRevision(draft.id, user)).resolves.toEqual({ deletedSeries: true });
  });
});
