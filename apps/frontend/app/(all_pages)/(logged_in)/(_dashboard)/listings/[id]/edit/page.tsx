import { notFound } from 'next/navigation';
import { MOCK_SUBLETS, CURRENT_USER_ID } from '@/app/lib/mock-data';
import ListingForm from '@/app/components/listings/listing-form';
import type { ListingFormData } from '@/app/lib/definitions';

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sublet = MOCK_SUBLETS.find((s) => s.id === id);
  if (!sublet || sublet.ownerId !== CURRENT_USER_ID) notFound();

  const initialData: ListingFormData = {
    placeType: sublet.placeType ?? 'entire',
    roommateCount: sublet.roommateCount ?? 0,
    streetAddress: sublet.streetAddress,
    city: sublet.city,
    state: sublet.state,
    zipCode: sublet.zipCode,
    bedroomCount: sublet.bedroomCount,
    bathroomCount: sublet.bathroomCount,
    monthlyRent: sublet.monthlyRent,
    utilitiesIncluded: sublet.utilitiesIncluded ?? false,
    monthlyUtilitiesCost: sublet.monthlyUtilitiesCost ?? 0,
    startDate: sublet.startDate,
    endDate: sublet.endDate,
    title: sublet.title,
    description: sublet.description,
  };

  return <ListingForm mode="edit" subletId={id} initialData={initialData} />;
}
