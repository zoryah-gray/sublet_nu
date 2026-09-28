import DashboardSidebar from "@/app/components/dashboard-sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}){
    return (
        <div className="flex flex-1 overflow-hidden min-h-0">
            <DashboardSidebar/>
            <>{children}</>
        </div>
    )
}