"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeLoginNext } from "@/lib/invitation-session";
import { isAuthConfigured } from "@/lib/supabase/config";

export type LoginState = { error: string | null };

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isAuthConfigured())
    return {
      error: "Sign-in is being set up. Please contact your account manager.",
    };
  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    email.length > 254 ||
    password.length === 0 ||
    password.length > 1024
  ) {
    return { error: "Enter your email address and password." };
  }
  try {
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error)
      return {
        error:
          "We could not sign you in. Check your email and password, then try again.",
      };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }
  redirect(safeLoginNext(formData.get("next")));
}
