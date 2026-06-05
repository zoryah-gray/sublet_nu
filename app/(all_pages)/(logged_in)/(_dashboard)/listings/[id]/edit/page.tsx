import { notFound } from 'next/navigation';
import { MOCK_SUBLETS, CURRENT_USER_ID } from '@/app/lib/mock-data';
import ListingForm from '@/app/components/listings/listing-form';
import type { ListingFormData } from '@/app/components/listings/listing-form';

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sublet = MOCK_SUBLETS.find((s) => s.id === id);
  if (!sublet || sublet.ownerId !== CURRENT_USER_ID) notFound();

  const initialData: ListingFormData = {
    placeType:         sublet.placeType         ?? 'entire',
    roommates:         sublet.roommates          ?? 0,
    address:           sublet.address,
    neighborhood:      sublet.neighborhood,
    beds:              sublet.beds,
    baths:             sublet.baths,
    price:             sublet.price,
    utilitiesIncluded: sublet.utilitiesIncluded  ?? false,
    utilitiesCost:     sublet.utilitiesCost       ?? 0,
    quarters:          sublet.quarters,
    startDate:         sublet.startDate,
    endDate:           sublet.endDate,
    title:             sublet.title,
    description:       sublet.description,
  };

  return <ListingForm mode="edit" subletId={id} initialData={initialData} />;
}
