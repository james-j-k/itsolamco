"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="font-mono text-[10px] tracking-[0.2em] uppercase border-2 border-[#1C1712] px-4 py-2 hover:bg-[#1C1712] hover:text-[#F5F0E6] transition-all"
    >
      Log Out
    </button>
  );
}
