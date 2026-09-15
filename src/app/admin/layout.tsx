import { getCurrentAdmin } from "@/lib/session";
import LogoutButton from "@/components/admin/LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  return (
    <div className="min-h-screen bg-[#F5F0E6] text-[#1C1712]">
      {admin && (
        <header className="border-b-2 border-[#1C1712] px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-[#B8451D] tracking-[0.2em] uppercase">It&apos;s Olam Company</div>
            <div className="font-mono text-[10px] text-[#8C8477]">{admin.email}</div>
          </div>
          <LogoutButton />
        </header>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
