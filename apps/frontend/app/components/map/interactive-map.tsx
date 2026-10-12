'use client';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { Map as LeafletMap } from 'leaflet';
import { MapPinIcon } from '@heroicons/react/24/solid';
import { Map, MapCircle, MapLocateControl, MapMarker, MapMarkerClusterGroup, MapPopup, MapTileLayer, MapZoomControl, useLeaflet } from '@/components/ui/map';
import { EVANSTON_COORDINATES } from '@/app/lib/definitions';
import type { PublicSublet } from '@/app/lib/definitions';
import { useSSRSafeMediaQuery } from '@/app/lib/utils';
import { approximateCoords, APPROXIMATE_RADIUS_METERS, filterInViewport } from '@/app/lib/util-address';
import type { MapViewport } from '@/app/lib/util-address';

// Below this zoom a 200m circle is a few pixels wide and pins are mostly
// clustered, so circles add draw cost without telling the user anything.
const CIRCLE_MIN_ZOOM = 14;

// Created once: MapMarker turns this into HTML per marker, so a stable element
// plus the memoized marker list below keeps pans from rebuilding every icon.
const PIN_ICON = <MapPinIcon className='size-8 text-violet-800 drop-shadow' />;

/**
  * The map's zoom and padded visible bounds, re-read whenever Leaflet finishes a
  * pan or zoom ('moveend' fires for both). The snapshot is a string so React's
  * equality check is a cheap primitive compare and unchanged views don't re-render.
  */
function useMapViewport(map: LeafletMap | null): MapViewport | null {
    const subscribe = useCallback((onChange: () => void) => {
        if (!map) return () => {};
        map.on('moveend', onChange);
        return () => {
            map.off('moveend', onChange);
        };
    }, [map]);

    const snapshot = useSyncExternalStore(
        subscribe,
        () => (map ? `${map.getZoom()}|${map.getBounds().pad(0.25).toBBoxString()}` : ''),
        () => '',
    );

    return useMemo(() => {
        if (!snapshot) return null;
        const [zoom, bbox] = snapshot.split('|');
        const [west, south, east, north] = bbox.split(',').map(Number);
        return { zoom: Number(zoom), west, south, east, north };
    }, [snapshot]);
}

export default function MapUI({
    sublets,
    onMarkerClick,
    saveData = false,
}: {
    sublets: PublicSublet[];
    onMarkerClick: (sublet: PublicSublet) => void;
    /** Data Saver on: no animations, and tiles only fetched once panning/zooming stops. */
    saveData?: boolean;
}) {
    const isMobile = useSSRSafeMediaQuery('(max-width: 767px)');
    const zoomCtrl = isMobile ? 11 : 13;
    const { L } = useLeaflet();
    const [map, setMap] = useState<LeafletMap | null>(null);
    const viewport = useMapViewport(map);

    // Pins and circles both sit on the snapped grid-cell center, never the exact
    // coords — a pin on the true point would undo the circle (util-address.ts).
    const placed = useMemo(
        () => sublets.map((sublet) => ({ sublet, center: approximateCoords(sublet.coords) })),
        [sublets],
    );

    // One shared canvas for every circle instead of one SVG element each; only
    // the circles use it, so the cluster group's own polygons keep their styling.
    const circleRenderer = useMemo(() => L?.canvas({ padding: 0.25 }), [L]);

    const visibleCircles = useMemo(() => filterInViewport(placed, viewport, CIRCLE_MIN_ZOOM), [placed, viewport]);

    // Memoized so a pan (which changes `viewport`) re-renders only the circles;
    // the cluster group already adds just the in-view markers to the DOM
    // (leaflet.markercluster's removeOutsideVisibleBounds, on by default).
    const markers = useMemo(() => placed.map(({ sublet, center }) => (
        <MapMarker
            key={sublet.id}
            position={center}
            riseOnHover={true}
            icon={PIN_ICON}
            eventHandlers={{
                click: () => onMarkerClick(sublet),
            }}
        >
            {isMobile &&
                <MapPopup>
                    <div>
                        <div className="font-semibold text-gray-900 text-sm truncate">{sublet.title}</div>
                        <div className="text-xs text-violet-800 font-bold mt-1">${sublet.monthlyRent.toLocaleString()}/mo</div>
                        <div className="mt-2.5 rounded-md bg-violet-800 text-white">
                            <Link href={`/sublet/${sublet.id}`} className="block text-center text-xs font-semibold py-1.5">
                                View listing
                            </Link>
                        </div>
                    </div>
                </MapPopup>
            }
        </MapMarker>
    )), [placed, onMarkerClick, isMobile]);

    return (
        <div className="w-full h-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
            <Map
                ref={setMap}
                center={EVANSTON_COORDINATES}
                zoom={zoomCtrl}
                zoomAnimation={!saveData}
                fadeAnimation={!saveData}
                markerZoomAnimation={!saveData}
            >
                <MapTileLayer updateWhenZooming={!saveData} updateWhenIdle={saveData} />
                <div className="absolute bottom-1 right-1 z-1000 grid gap-1">
                    <MapZoomControl className='static' />
                    <MapLocateControl className='static' />
                </div>

                {/* Approximate-area circles. Leaflet draws vector layers in the overlay
                        pane, below the marker pane, so they always sit under the pins. */}
                {circleRenderer && visibleCircles.map(({ sublet, center }) => (
                    <MapCircle
                        key={sublet.id}
                        center={center}
                        radius={APPROXIMATE_RADIUS_METERS}
                        renderer={circleRenderer}
                        interactive={false}
                        pathOptions={{ color: '#6d28d9', weight: 1.5, fillColor: '#8b5cf6', fillOpacity: 0.18 }}
                    />
                ))}

                <MapMarkerClusterGroup chunkedLoading>
                    {markers}
                </MapMarkerClusterGroup>
            </Map>
        </div>
    );
}
