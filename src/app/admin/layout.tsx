import Link from "next/link";
import { getCurrentAdmin } from "@/lib/session";
import LogoutButton from "@/components/admin/LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#1C1712]">
      {admin && (
        <header className="border-b-2 border-[#1C1712] px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] text-[#B8451D] tracking-[0.2em] uppercase">It&apos;s Olam Company</div>
            <div className="font-mono text-[10px] text-[#8C8477] break-all">{admin.email}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/security"
              className="font-mono text-[10px] tracking-[0.2em] uppercase border-2 border-[#1C1712] px-4 py-2 whitespace-nowrap hover:bg-[#1C1712] hover:text-[#F5F0E6] transition-all"
            >
              Security
            </Link>
            <LogoutButton />
          </div>
        </header>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
