import { redirect } from "next/navigation";

// The error Next throws for redirect("/login"): what signed-out users trigger inside a data call
export const redirectError = (): unknown => {
  try {
    return redirect("/login");
  } catch (error) {
    return error;
  }
};
