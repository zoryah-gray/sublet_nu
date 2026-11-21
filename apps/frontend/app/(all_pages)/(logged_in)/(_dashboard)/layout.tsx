import DashboardSidebar from "@/app/components/dashboard-sidebar";
import { getSessionUser } from "@/app/lib/dal";

/** Dashboard shell. Reads the session user server-side and hands it to the client sidebar. */
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}){
    return (
        <div className="flex flex-1 overflow-hidden min-h-0">
            <DashboardSidebar user={await getSessionUser()}/>
            <>{children}</>
        </div>
    )
}