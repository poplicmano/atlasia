import { redirect } from "next/navigation";
import { getOptionalPageContext } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default function RootPage() {
  redirect(getOptionalPageContext() ? "/dashboard" : "/login");
}
