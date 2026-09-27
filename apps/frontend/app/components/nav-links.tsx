'use client';

import clsx from "clsx";
import { HomeIcon, QuestionMarkCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { usePathname } from "next/navigation";
import Link from "next/link";

const links = [
    {
        name: 'Home',
        href: '/home',
        icon: HomeIcon
    },
    {
        name: 'Profile',
        href:'/dashboard',
        icon: UserGroupIcon
    },
    {
        name: 'About',
        href: '/',
        icon: QuestionMarkCircleIcon
    }
]

export default function NavLinks(){
    const currPathname = usePathname();
    return(
        <>
            {links.map((link) => {
                const LinkIcon = link.icon;
                return (
                    <Link
                        key={link.name}
                        href={link.href}
                        className={clsx("flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3",
                        { "bg-sky-100 text-blue-600":currPathname === link.href}
                        )}
                    >
                        <LinkIcon className="w-6"/>
                        <p className="hidden md:block">{link.name}</p>
                    </Link>
                );
            })}
        </>
    )
}