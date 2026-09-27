'use client';
import Link from 'next/link';
import { useMediaQuery } from 'react-responsive';
import { MapPinIcon } from '@heroicons/react/24/solid';
import { Map, MapLocateControl, MapMarker, MapMarkerClusterGroup, MapPopup, MapTileLayer, MapZoomControl } from '@/components/ui/map';
import { EVANSTON_COORDINATES } from '@/app/lib/definitions';
import type { Sublet } from '@/app/lib/definitions';

export default function MapUI({
    sublets,
    onMarkerClick,
}: {
    sublets: Sublet[];
    onMarkerClick: (sublet: Sublet) => void;
}) {
    const isMobile = useMediaQuery({ maxWidth: 767 });
    const zoomCtrl = isMobile ? 11 : 13;

    return (
        <div className="w-full h-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
            <Map center={EVANSTON_COORDINATES} zoom={zoomCtrl}>
                <MapTileLayer />
                <div className="absolute bottom-1 right-1 z-1000 grid gap-1">
                    <MapZoomControl className='static' />
                    <MapLocateControl className='static' />
                </div>

                <MapMarkerClusterGroup>
                    {sublets.map((sublet) => (
                        <MapMarker
                            key={sublet.id}
                            position={sublet.coords}
                            riseOnHover={true}
                            icon={<MapPinIcon className='size-8 text-violet-800 drop-shadow' />}
                            eventHandlers={{
                                click: () => onMarkerClick(sublet),
                            }}
                        >
                            {isMobile && 
                                <MapPopup>
                                    <div>
                                        <div className="font-semibold text-gray-900 text-sm truncate">{sublet.title}</div>
                                        <div className="text-xs text-violet-800 font-bold mt-1">${sublet.price.toLocaleString()}/mo</div>
                                        <div className="mt-2.5 rounded-md bg-violet-800 text-white">
                                            <Link href={`/sublet/${sublet.id}`} className="block text-center text-xs font-semibold py-1.5">
                                                View listing
                                            </Link>
                                        </div>
                                    </div>
                                </MapPopup>
                            }
                        </MapMarker>
                    ))}
                </MapMarkerClusterGroup>
            </Map>
        </div>
    );
}
