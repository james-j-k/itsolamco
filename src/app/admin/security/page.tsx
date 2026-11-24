import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/session";
import SecurityPanel from "@/components/admin/SecurityPanel";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const session = await getCurrentAdmin();
  if (!session) redirect("/admin/login");
  const admin = await prisma.admin.findUnique({ where: { id: session.adminId } });
  if (!admin) redirect("/admin/login");

  return (
    <div className="max-w-xl mx-auto">
      <Link href="/admin" className="font-mono text-[10px] uppercase tracking-[0.2em] underline">&larr; Back to admin</Link>
      <h1 className="uppercase text-3xl mt-4 mb-6" style={{ fontFamily: "sans-serif", letterSpacing: "-0.02em" }}>Security</h1>
      <SecurityPanel initial={{ email: admin.email, enabled: Boolean(admin.totpEnabledAt && admin.totpSecret), recoveryLeft: admin.recoveryHashes.length }} />
    </div>
  );
}
