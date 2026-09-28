import NavBar from "@/app/components/navbar";

export default function Layout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
        <NavBar/>
        <>{children}</>
    </div>)
}