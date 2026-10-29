import { z } from "zod";

// Result of a form Server Action, as read by useActionState
export type FormState<Field extends string> = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  // Sent back so the form can refill itself: React clears uncontrolled fields after an action
  values?: Record<Field, string>;
};

// FormData entries can also be files; only text is ever expected here
export function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function readFormValues<Field extends string>(
  formData: FormData,
  fields: readonly Field[],
) {
  return Object.fromEntries(
    fields.map((field) => [field, formText(formData, field)]),
  ) as Record<Field, string>;
}

// First message per field, for showing next to each input
export function validationFailure<Field extends string>(
  error: z.ZodError,
  values: Record<Field, string>,
): FormState<Field> {
  const { fieldErrors: flat } = z.flattenError(error) as {
    fieldErrors: Record<string, string[] | undefined>;
  };

  const fieldErrors: Partial<Record<Field, string>> = {};
  for (const [field, messages] of Object.entries(flat)) {
    if (messages?.[0]) fieldErrors[field as Field] = messages[0];
  }
  return { status: "error", fieldErrors, values };
}
