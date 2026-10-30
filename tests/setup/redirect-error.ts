import { redirect } from "next/navigation";

// The error Next throws for redirect("/login"): what signed-out users trigger inside a data call
export const redirectError = () => {
  try {
    redirect("/login");
  } catch (error) {
    return error;
  }
  throw new Error("redirect() did not throw");
};
