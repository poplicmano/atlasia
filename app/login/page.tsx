import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getOptionalPageContext } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (getOptionalPageContext()) redirect("/dashboard");
  return <LoginForm />;
}
