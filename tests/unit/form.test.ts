import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  formText,
  readFormValues,
  validationFailure,
} from "@/lib/validation/form";

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
};

describe("formText", () => {
  it("returns text fields", () => {
    expect(formText(form({ name: "Rent" }), "name")).toBe("Rent");
  });

  it("returns an empty string for a missing field", () => {
    expect(formText(form({}), "name")).toBe("");
  });

  it("ignores uploaded files", () => {
    const formData = new FormData();
    formData.set("name", new File(["x"], "x.txt"));

    expect(formText(formData, "name")).toBe("");
  });
});

describe("readFormValues", () => {
  it("reads exactly the listed fields and ignores the rest", () => {
    const values = readFormValues(form({ a: "1", b: "2", userId: "someone-else" }), ["a", "b", "c"]);

    expect(values).toEqual({ a: "1", b: "2", c: "" });
  });
});

describe("validationFailure", () => {
  const schema = z.object({
    name: z.string().min(1, "Enter a name"),
    color: z.string().regex(/^#/, "Pick a valid color"),
  });
  const values = { name: "", color: "red" };

  it("keeps the first message of each failing field and the submitted values", () => {
    const result = schema.safeParse(values);
    if (result.success) throw new Error("expected a validation error");

    expect(validationFailure(result.error, values)).toEqual({
      status: "error",
      fieldErrors: { name: "Enter a name", color: "Pick a valid color" },
      values,
    });
  });

  it("only reports the fields that failed", () => {
    const failing = { name: "Rent", color: "red" };
    const result = schema.safeParse(failing);
    if (result.success) throw new Error("expected a validation error");

    expect(validationFailure(result.error, failing).fieldErrors).toEqual({ color: "Pick a valid color" });
  });
});
