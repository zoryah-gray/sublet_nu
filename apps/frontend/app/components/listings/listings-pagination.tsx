'use client';

import { useRouter, usePathname } from 'next/navigation';
import Pagination from '@/app/components/pagination';

interface ListingsPaginationProps {
  page: number;
  total: number;
  perPage: number;
}

/** Client island: drives URL-based pagination for the My Listings server page. */
export default function ListingsPagination({ page, total, perPage }: ListingsPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (p: number) => {
    const params = new URLSearchParams();
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  return <Pagination page={page} total={total} perPage={perPage} onChange={handleChange} />;
}
