import NavLinks from "./nav-links";

export default function SideNav(){
    return (
        <div className="h-full flex flex-col px-3 py-4 md:px-2 border-r-2 border-r-neutral-300">
            <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2">
                <NavLinks/>
            </div>
            
            <div className="hidden h-auto w-full grow rounded-md bg-gray-50 md:block"></div>

            <p className="text-sm text-gray-600">SubletNU ©</p>
        </div>
        
    )
}