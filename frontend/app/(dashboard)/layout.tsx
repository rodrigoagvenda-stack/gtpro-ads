import Sidebar from "@/components/dashboard/Sidebar"
import Preloader from "@/components/dashboard/Preloader"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full bg-[#08080a]">
      <Preloader />
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-8 py-7">{children}</div>
      </main>
    </div>
  )
}
