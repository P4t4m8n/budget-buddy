import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import {
  createInvestmentAction,
  deleteInvestmentAction,
  updateInvestmentAction,
  updateInvestmentValueAction,
} from "@/actions/investments";
import { APP_TIME_ZONE } from "@/lib/constants";
import { currentDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { createUser, deleteTestUsers, signInAs, signOut } from "./support";

const idle = { status: "idle" } as const;

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

let alice: { id: string };
let bob: { id: string };

const createForm = (overrides: Record<string, string> = {}) =>
  form({
    name: "S&P 500 ETF",
    type: "ETF",
    ticker: "voo",
    amountInvested: "8000.50",
    currentValue: "9150.25",
    purchaseDate: "2025-03-10",
    ...overrides,
  });

// What the edit dialog sends: no current value
const editForm = (overrides: Record<string, string> = {}) =>
  form({
    name: "Renamed",
    type: "STOCK",
    ticker: "",
    amountInvested: "1200",
    purchaseDate: "2024-05-05",
    ...overrides,
  });

const seed = async (userId: string, name = "Apple", value: number | string = 1000) =>
  (
    await prisma.investment.create({
      data: {
        userId,
        name,
        type: "STOCK",
        amountInvested: 1000,
        currentValue: value,
        purchaseDate: new Date("2025-01-01T00:00:00Z"),
      },
    })
  ).id;

const investmentsOf = (userId: string) => prisma.investment.findMany({ where: { userId } });
const snapshotsOf = (investmentId: string) => prisma.investmentSnapshot.findMany({ where: { investmentId } });

// The day the action ran on: its own clock, so check both sides of the call
const dayAround = async (run: () => Promise<unknown>) => {
  const before = currentDate(new Date(), APP_TIME_ZONE);
  await run();
  return new Set([before, currentDate(new Date(), APP_TIME_ZONE)]);
};
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

beforeEach(async () => {
  vi.mocked(revalidatePath).mockClear();
  alice = await createUser("alice");
  bob = await createUser("bob");
  await signInAs(alice);
});

afterEach(deleteTestUsers);
afterAll(() => prisma.$disconnect());

// These call the Server Actions the way a browser would: anyone can POST to them,
// so each one has to be safe on its own
describe("investment Server Actions against the database", () => {
  it("creates an investment for the signed-in user with exact amounts, and its first history point", async () => {
    const days = await dayAround(async () => {
      expect(await createInvestmentAction(idle, createForm())).toEqual({ status: "success" });
    });

    const [row] = await investmentsOf(alice.id);
    expect(row).toMatchObject({ name: "S&P 500 ETF", type: "ETF", ticker: "VOO", currency: "ILS" });
    expect(row.amountInvested.toString()).toBe("8000.5");
    expect(row.currentValue.toString()).toBe("9150.25");
    expect(row.purchaseDate.toISOString()).toBe("2025-03-10T00:00:00.000Z");
    const [snapshot] = await snapshotsOf(row.id);
    expect(snapshot.value.toString()).toBe("9150.25");
    expect(days.has(isoDay(snapshot.date))).toBe(true);
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("ignores a userId, id or currency in the form data", async () => {
    await createInvestmentAction(idle, createForm({ userId: bob.id, id: "chosen-id", currency: "USD" }));

    expect(await investmentsOf(bob.id)).toEqual([]);
    const [row] = await investmentsOf(alice.id);
    expect(row.id).not.toBe("chosen-id");
    expect(row.currency).toBe("ILS");
  });

  it("saves nothing when validation fails", async () => {
    const result = await createInvestmentAction(
      idle,
      createForm({ name: "", amountInvested: "0", currentValue: "-1", purchaseDate: "" }),
    );

    expect(result.status).toBe("error");
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
      "amountInvested",
      "currentValue",
      "name",
      "purchaseDate",
    ]);
    expect(await prisma.investment.count()).toBe(0);
    expect(await prisma.investmentSnapshot.count()).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("updates one's own investment from the edit form, leaving its value and history alone", async () => {
    const id = await seed(alice.id, "Apple", 1500);

    expect(await updateInvestmentAction(id, idle, editForm())).toEqual({ status: "success" });

    const row = await prisma.investment.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ name: "Renamed", type: "STOCK", ticker: null });
    expect(row.amountInvested.toString()).toBe("1200");
    expect(row.currentValue.toString()).toBe("1500");
    expect(await snapshotsOf(id)).toEqual([]);
  });

  it("can't change the current value through the edit form", async () => {
    const id = await seed(alice.id, "Apple", 1500);

    await updateInvestmentAction(id, idle, editForm({ currentValue: "1" }));

    expect((await prisma.investment.findUniqueOrThrow({ where: { id } })).currentValue.toString()).toBe("1500");
  });

  it("can't update another user's investment, even with its id", async () => {
    const id = await seed(bob.id, "Bob's");

    const result = await updateInvestmentAction(id, idle, editForm({ name: "Hijacked" }));

    expect(result).toMatchObject({ status: "error", errorCode: "NOT_FOUND" });
    expect(await prisma.investment.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: "Bob's" });
  });

  it("sets the value and records it for today, and the date can't be chosen through the form", async () => {
    const id = await seed(alice.id);

    const days = await dayAround(async () => {
      expect(
        await updateInvestmentValueAction(id, idle, form({ value: "1234.56", date: "2020-01-01", userId: bob.id })),
      ).toEqual({ status: "success" });
    });

    expect((await prisma.investment.findUniqueOrThrow({ where: { id } })).currentValue.toString()).toBe("1234.56");
    const [snapshot] = await snapshotsOf(id);
    expect(snapshot.value.toString()).toBe("1234.56");
    expect(snapshot.userId).toBe(alice.id);
    expect(days.has(isoDay(snapshot.date))).toBe(true);
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/savings");
  });

  it("keeps one value per day when the value is updated twice", async () => {
    const id = await seed(alice.id);

    await updateInvestmentValueAction(id, idle, form({ value: "100" }));
    await updateInvestmentValueAction(id, idle, form({ value: "150" }));

    const snapshots = await snapshotsOf(id);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].value.toString()).toBe("150");
  });

  it("refuses an invalid value and records nothing", async () => {
    const id = await seed(alice.id);

    const result = await updateInvestmentValueAction(id, idle, form({ value: "-5" }));

    expect(result.fieldErrors?.value).toBe("Enter an amount like 12.50");
    expect(await snapshotsOf(id)).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("can't set the value of another user's investment, even with its id", async () => {
    const id = await seed(bob.id, "Bob's", 100);

    const result = await updateInvestmentValueAction(id, idle, form({ value: "999" }));

    expect(result).toMatchObject({ status: "error", errorCode: "NOT_FOUND" });
    expect((await prisma.investment.findUniqueOrThrow({ where: { id } })).currentValue.toString()).toBe("100");
    expect(await snapshotsOf(id)).toEqual([]);
  });

  it("deletes one's own investment with its history", async () => {
    const id = await seed(alice.id);
    await updateInvestmentValueAction(id, idle, form({ value: "100" }));

    expect(await deleteInvestmentAction(id)).toEqual({ ok: true });

    expect(await investmentsOf(alice.id)).toEqual([]);
    expect(await prisma.investmentSnapshot.count()).toBe(0);
  });

  it("can't delete another user's investment, even with its id", async () => {
    const id = await seed(bob.id);

    expect(await deleteInvestmentAction(id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await investmentsOf(bob.id)).toHaveLength(1);
  });

  it("sends signed-out callers to /login instead of returning data", async () => {
    const id = await seed(alice.id);
    signOut();
    const toLogin = { digest: expect.stringContaining("/login") };

    await expect(createInvestmentAction(idle, createForm())).rejects.toMatchObject(toLogin);
    await expect(updateInvestmentAction(id, idle, editForm())).rejects.toMatchObject(toLogin);
    await expect(updateInvestmentValueAction(id, idle, form({ value: "1" }))).rejects.toMatchObject(toLogin);
    await expect(deleteInvestmentAction(id)).rejects.toMatchObject(toLogin);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await prisma.investment.count()).toBe(1);
    expect(await prisma.investmentSnapshot.count()).toBe(0);
  });
});
