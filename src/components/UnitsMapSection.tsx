import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Bike,
  Car,
  Crosshair,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Search,
  Star,
  X,
} from 'lucide-react';
import { UnitLocation } from '../types';
import { LANGUAGE_META, SiteLanguage, UI_TRANSLATIONS } from '../utils/i18n';
import { ErrorBoundary } from './ErrorBoundary';
import { WhatsAppIcon, buildWhatsAppHref, getUnitWhatsAppNumber } from './WhatsAppIcon';

interface UnitsMapSectionProps {
  units: UnitLocation[];
  mapsActive: boolean;
  mapsApiKey: string;
  language?: SiteLanguage;
  renderEyebrow?: () => React.ReactNode;
  renderTitle?: () => React.ReactNode;
  renderSubtitle?: () => React.ReactNode;
}

interface RouteOverlayProps {
  origin: string | google.maps.LatLngLiteral | null;
  destination: google.maps.LatLngLiteral | null;
  travelMode: 'moto' | 'carro';
  onRouteResult: (info: { distanceKm: string; durationMin: number } | null, error: string | null) => void;
}

function formatUnitAddress(unit: UnitLocation): string {
  const streetPart = unit.number ? `${unit.street}, ${unit.number}` : unit.street;
  const neighborhoodPart = unit.neighborhood ? ` - ${unit.neighborhood}` : '';
  return `${streetPart}${neighborhoodPart}, ${unit.city} - ${unit.state}, ${unit.zip}`;
}

function buildUnitPlaceQuery(unit: UnitLocation): string {
  const fullAddr = formatUnitAddress(unit);
  const nameLower = (unit.name || '').toLowerCase();
  const brandPrefix =
    nameLower.includes('rodaleve') || unit.id === 'vitoria-da-conquista'
      ? 'Rodaleve Honda'
      : unit.name || 'Rodaleve Honda';
  return `${brandPrefix}, ${fullAddr}`;
}

function buildDirectMapsUrl(unit: UnitLocation): string {
  const query = buildUnitPlaceQuery(unit);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function RouteOverlay({ origin, destination, travelMode, onRouteResult }: RouteOverlayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    let cancelled = false;

    const compute = async (mode: 'TWO_WHEELER' | 'DRIVING') => {
      const request = {
        origin,
        destination,
        travelMode: mode,
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
      };
      return (routesLib.Route as unknown as { computeRoutes: (req: unknown) => Promise<{ routes: any[] }> }).computeRoutes(
        request
      );
    };

    (async () => {
      try {
        let response: { routes: any[] };
        try {
          response = await compute(travelMode === 'moto' ? 'TWO_WHEELER' : 'DRIVING');
        } catch (err) {
          if (travelMode === 'moto') {
            response = await compute('DRIVING');
          } else {
            throw err;
          }
        }

        if (cancelled) return;
        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          onRouteResult(null, 'Não foi possível encontrar uma rota para este endereço.');
          return;
        }

        const newPolylines: google.maps.Polyline[] = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#E4002B',
            strokeWeight: 5,
            strokeOpacity: 0.9,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        const distanceKm = ((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(1).replace('.', ',');
        const durationMin = Math.max(1, Math.round((primaryRoute.durationMillis ?? 0) / 60000));
        onRouteResult({ distanceKm, durationMin }, null);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onRouteResult(null, 'Não foi possível calcular a rota neste momento. Tente abrir diretamente no Google Maps.');
      }
    })();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin, destination, travelMode, onRouteResult]);

  return null;
}

/**
 * Resolves exact coordinates for each dealership unit using Places API (New) Place.searchByText
 * (so business name + address resolves directly onto the dealership POI) with Geocoder fallback.
 */
function UnitAddressGeocoder({
  units,
  onResolved,
}: {
  units: UnitLocation[];
  onResolved: (coordsById: Record<string, google.maps.LatLngLiteral>) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  const cacheRef = useRef<Record<string, google.maps.LatLngLiteral>>({});

  useEffect(() => {
    if ((!placesLib && !geocodingLib) || units.length === 0) return;
    let cancelled = false;
    const geocoder = geocodingLib ? new geocodingLib.Geocoder() : null;

    (async () => {
      const updates: Record<string, google.maps.LatLngLiteral> = {};
      for (const unit of units) {
        const placeQuery = buildUnitPlaceQuery(unit);
        const addrQuery = formatUnitAddress(unit);
        const cacheKey = `${unit.id}::${placeQuery}`;
        if (cacheRef.current[cacheKey]) {
          updates[unit.id] = cacheRef.current[cacheKey];
          continue;
        }

        let resolved: google.maps.LatLngLiteral | null = null;

        if (placesLib?.Place?.searchByText) {
          try {
            const { places } = await placesLib.Place.searchByText({
              textQuery: placeQuery,
              fields: ['displayName', 'location'],
              locationBias: { lat: unit.lat, lng: unit.lng },
              maxResultCount: 1,
              language: 'pt-BR',
              region: 'br',
            });
            const loc = places?.[0]?.location;
            if (loc) {
              resolved = { lat: loc.lat(), lng: loc.lng() };
            }
          } catch {
            // Fall through to Geocoder fallback
          }
        }

        if (!resolved && geocoder) {
          for (const q of [placeQuery, addrQuery]) {
            try {
              const result = await geocoder.geocode({ address: q, region: 'BR' });
              const loc = result.results?.[0]?.geometry?.location;
              if (loc) {
                resolved = { lat: loc.lat(), lng: loc.lng() };
                break;
              }
            } catch {
              // Try next query or fall back silently to stored unit.lat / unit.lng
            }
          }
        }

        if (resolved) {
          cacheRef.current[cacheKey] = resolved;
          updates[unit.id] = resolved;
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        onResolved(updates);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [placesLib, geocodingLib, units, onResolved]);

  return null;
}

function UnitMarker({
  unit,
  position,
  isSelected,
  isInfoOpen,
  openInMapsLabel,
  onSelect,
  onCloseInfo,
}: {
  unit: UnitLocation;
  position: google.maps.LatLngLiteral;
  isSelected: boolean;
  isInfoOpen: boolean;
  openInMapsLabel: string;
  onSelect: () => void;
  onCloseInfo: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        onClick={onSelect}
        title={unit.name}
      >
        <Pin
          background={isSelected ? '#E4002B' : '#18181B'}
          borderColor="#FFFFFF"
          glyphColor="#FFFFFF"
          scale={isSelected ? 1.25 : 1.05}
        />
      </AdvancedMarker>
      {isInfoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={onCloseInfo}>
          <div className="min-w-[220px] p-1 text-neutral-900">
            <p className="text-sm font-bold text-neutral-900">{unit.name}</p>
            <p className="mt-1 text-xs text-neutral-600">{formatUnitAddress(unit)}</p>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {Number(unit.rating ?? 4.8).toFixed(1)}
              </span>
              <a
                href={unit.gmb_url || buildDirectMapsUrl(unit)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#E4002B] hover:underline"
              >
                {openInMapsLabel}
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface OriginSuggestionItem {
  id: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  placePrediction?: google.maps.places.PlacePrediction;
  coords?: google.maps.LatLngLiteral;
}

function OriginAutocompleteInput({
  value,
  onChange,
  onSelectOrigin,
  onClear,
  biasCenter,
  placeholder,
  clearAddressLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  onSelectOrigin: (label: string, origin: string | google.maps.LatLngLiteral) => void;
  onClear: () => void;
  biasCenter: google.maps.LatLngLiteral;
  placeholder: string;
  clearAddressLabel: string;
}) {
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const skipNextFetchRef = useRef(false);
  const requestIdRef = useRef(0);

  const [suggestions, setSuggestions] = useState<OriginSuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const onPointerDown = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const trimmed = value.trim();
    const isCoordString = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.test(trimmed);
    if (trimmed.length < 3 || isCoordString || (!placesLib && !geocodingLib)) {
      setSuggestions([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    const reqId = ++requestIdRef.current;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      let items: OriginSuggestionItem[] = [];

      if (placesLib?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        try {
          if (!sessionTokenRef.current && placesLib.AutocompleteSessionToken) {
            sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
          }
          const request: google.maps.places.AutocompleteRequest = {
            input: trimmed,
            sessionToken: sessionTokenRef.current ?? undefined,
            language: 'pt-BR',
            region: 'br',
            includedRegionCodes: ['br'],
            origin: biasCenter,
            locationBias: {
              north: biasCenter.lat + 0.8,
              south: biasCenter.lat - 0.8,
              east: biasCenter.lng + 0.8,
              west: biasCenter.lng - 0.8,
            },
            internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
          };
          const { suggestions: raw } =
            await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

          items = (raw || [])
            .filter((s) => Boolean(s.placePrediction))
            .slice(0, 5)
            .map((s, idx) => {
              const pred = s.placePrediction!;
              return {
                id: pred.placeId || `pred-${idx}`,
                mainText: pred.mainText?.text || pred.text.text,
                secondaryText: pred.secondaryText?.text || '',
                fullText: pred.text.text,
                placePrediction: pred,
              };
            });
        } catch {
          // Fall back to Geocoding API below if Places Autocomplete isn't active
        }
      }

      if (items.length === 0 && geocodingLib?.Geocoder) {
        try {
          const geocoder = new geocodingLib.Geocoder();
          const { results } = await geocoder.geocode({
            address: trimmed,
            region: 'BR',
            componentRestrictions: { country: 'BR' },
            bounds: {
              north: biasCenter.lat + 0.8,
              south: biasCenter.lat - 0.8,
              east: biasCenter.lng + 0.8,
              west: biasCenter.lng - 0.8,
            },
          });
          items = (results || []).slice(0, 5).map((r, idx) => {
            const parts = r.formatted_address.split(',');
            const main = parts[0]?.trim() || r.formatted_address;
            const sec = parts.slice(1).join(',').trim();
            return {
              id: r.place_id || `geo-${idx}`,
              mainText: main,
              secondaryText: sec,
              fullText: r.formatted_address,
              coords: {
                lat: r.geometry.location.lat(),
                lng: r.geometry.location.lng(),
              },
            };
          });
        } catch {
          items = [];
        }
      }

      if (reqId !== requestIdRef.current) return;
      setSuggestions(items);
      setActiveIndex(-1);
      setIsLoading(false);
      setIsOpen(items.length > 0);
    }, 220);

    return () => clearTimeout(timer);
  }, [value, placesLib, geocodingLib, biasCenter]);

  const handleSelectItem = useCallback(
    async (item: OriginSuggestionItem) => {
      skipNextFetchRef.current = true;
      setIsOpen(false);
      setSuggestions([]);
      setActiveIndex(-1);

      if (item.placePrediction) {
        try {
          const place = item.placePrediction.toPlace();
          await place.fetchFields({
            fields: ['location', 'formattedAddress', 'displayName'],
          });
          sessionTokenRef.current = null;
          const label = place.formattedAddress || item.fullText;
          const coords = place.location
            ? { lat: place.location.lat(), lng: place.location.lng() }
            : undefined;
          onSelectOrigin(label, coords || label);
          return;
        } catch {
          sessionTokenRef.current = null;
          onSelectOrigin(item.fullText, item.fullText);
          return;
        }
      }

      onSelectOrigin(item.fullText, item.coords || item.fullText);
    },
    [onSelectOrigin]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      void handleSelectItem(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E4002B] focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />
        ) : value ? (
          <button
            type="button"
            onClick={() => {
              setSuggestions([]);
              setIsOpen(false);
              onClear();
            }}
            aria-label={clearAddressLabel}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        >
          {suggestions.map((item, idx) => (
            <li key={item.id} role="option" aria-selected={idx === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void handleSelectItem(item);
                }}
                className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                  idx === activeIndex
                    ? 'bg-neutral-100 dark:bg-neutral-800'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/70'
                }`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#E4002B]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-neutral-900 dark:text-white">
                    {item.mainText}
                  </p>
                  {item.secondaryText && (
                    <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                      {item.secondaryText}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MapCameraController({
  units,
  coordsById,
  selectedTab,
}: {
  units: UnitLocation[];
  coordsById: Record<string, google.maps.LatLngLiteral>;
  selectedTab: string;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');

  useEffect(() => {
    if (!map || units.length === 0) return;

    try {
      if (selectedTab === 'both' && units.length > 1 && coreLib) {
        const bounds = new coreLib.LatLngBounds();
        units.forEach((u) =>
          bounds.extend(
            coordsById[u.id] || {
              lat: Number(u.lat) || -14.8655,
              lng: Number(u.lng) || -40.8385,
            }
          )
        );
        map.fitBounds(bounds, 60);
      } else {
        const target = units.find((u) => u.id === selectedTab) || units[0];
        const pos = coordsById[target.id] || {
          lat: Number(target.lat) || -14.8655,
          lng: Number(target.lng) || -40.8385,
        };
        map.panTo(pos);
        map.setZoom(16);
      }
    } catch {
      // Ignore transient Google Maps camera errors when SDK fails to initialize
    }
  }, [map, coreLib, units, coordsById, selectedTab]);

  return null;
}

export function UnitsMapSection({
  units,
  mapsActive,
  mapsApiKey,
  language = 'pt',
  renderEyebrow,
  renderTitle,
  renderSubtitle,
}: UnitsMapSectionProps) {
  const dict = UI_TRANSLATIONS[language];
  const [selectedTab, setSelectedTab] = useState<string>(units[0]?.id || 'vitoria-da-conquista');
  const [infoOpenUnitId, setInfoOpenUnitId] = useState<string | null>(units[0]?.id || 'vitoria-da-conquista');
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite'>('roadmap');
  const [travelMode, setTravelMode] = useState<'moto' | 'carro'>('moto');
  const [originInput, setOriginInput] = useState('');
  const [activeOrigin, setActiveOrigin] = useState<string | google.maps.LatLngLiteral | null>(null);
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: string; durationMin: number } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<string, google.maps.LatLngLiteral>>({});
  const [mapsUnavailable, setMapsUnavailable] = useState(() =>
    typeof window !== 'undefined'
      ? Boolean((window as Window & { __rodaleveGmpAuthFailed?: boolean }).__rodaleveGmpAuthFailed)
      : false
  );

  useEffect(() => {
    const globallyFailed =
      typeof window !== 'undefined' &&
      Boolean((window as Window & { __rodaleveGmpAuthFailed?: boolean }).__rodaleveGmpAuthFailed);
    setMapsUnavailable(globallyFailed);
  }, [mapsApiKey, mapsActive]);

  useEffect(() => {
    const onUnavailable = () => setMapsUnavailable(true);
    window.addEventListener('gmp-auth-failure', onUnavailable);
    window.addEventListener('gmp-quota-exceeded', onUnavailable);
    return () => {
      window.removeEventListener('gmp-auth-failure', onUnavailable);
      window.removeEventListener('gmp-quota-exceeded', onUnavailable);
    };
  }, []);

  const safeUnits = Array.isArray(units) ? units : [];
  const activeUnit = safeUnits.find((u) => u.id === selectedTab) || safeUnits[0];

  const handleGeocoded = useCallback((resolved: Record<string, google.maps.LatLngLiteral>) => {
    setGeocodedCoords((prev) => ({ ...prev, ...resolved }));
  }, []);

  const coordsById = useMemo(() => {
    const map: Record<string, google.maps.LatLngLiteral> = {};
    for (const u of safeUnits) {
      map[u.id] = geocodedCoords[u.id] || {
        lat: Number(u.lat) || -14.8655,
        lng: Number(u.lng) || -40.8385,
      };
    }
    return map;
  }, [safeUnits, geocodedCoords]);

  const handleFocusOnMap = useCallback((unitId: string) => {
    setSelectedTab(unitId);
    setInfoOpenUnitId(unitId);
  }, []);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setRouteError(dict.geoUnsupported);
      return;
    }
    setLocating(true);
    setRouteError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOriginInput(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        setActiveOrigin(coords);
        setLocating(false);
      },
      () => {
        setRouteError(dict.geoError);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleTraceRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originInput.trim()) {
      setRouteError(dict.originRequiredError);
      return;
    }
    setRouteError(null);
    const coordMatch = originInput.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      setActiveOrigin({ lat: Number(coordMatch[1]), lng: Number(coordMatch[2]) });
    } else {
      setActiveOrigin(originInput.trim());
    }
  };

  const handleRouteResult = useCallback(
    (info: { distanceKm: string; durationMin: number } | null, error: string | null) => {
      setRouteSummary(info);
      setRouteError(error);
    },
    []
  );

  if (safeUnits.length === 0 || !activeUnit) return null;

  const canRenderInteractiveMap = mapsActive && Boolean(mapsApiKey) && !mapsUnavailable;
  const visibleUnits =
    selectedTab === 'both' ? safeUnits : safeUnits.filter((u) => u.id === activeUnit.id);
  const activeUnitCoords = coordsById[activeUnit.id] || {
    lat: Number(activeUnit.lat) || -14.8655,
    lng: Number(activeUnit.lng) || -40.8385,
  };
  const originMarkerCoords =
    activeOrigin && typeof activeOrigin === 'object' ? activeOrigin : null;

  const renderGridContent = (interactiveMapActive: boolean) => (
    <div className="mt-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
      {/* Left Column: Route Planner + Unit Card(s) */}
      <div className="flex flex-col gap-5 lg:col-span-5">
        {/* Route Card */}
        <form
          onSubmit={handleTraceRoute}
          className="rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-5 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              {dict.unitsRouteTitle(activeUnit?.city || activeUnit?.name || '')}
            </h3>
            <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setTravelMode('moto')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  travelMode === 'moto'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300'
                }`}
              >
                <Bike className="h-3.5 w-3.5" />
                {dict.modeMoto}
              </button>
              <button
                type="button"
                onClick={() => setTravelMode('carro')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  travelMode === 'carro'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300'
                }`}
              >
                <Car className="h-3.5 w-3.5" />
                {dict.modeCar}
              </button>
            </div>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {interactiveMapActive ? (
              <OriginAutocompleteInput
                value={originInput}
                onChange={(next) => setOriginInput(next)}
                onSelectOrigin={(label, origin) => {
                  setOriginInput(label);
                  setRouteError(null);
                  setActiveOrigin(origin);
                }}
                onClear={() => {
                  setOriginInput('');
                  setActiveOrigin(null);
                  setRouteSummary(null);
                  setRouteError(null);
                }}
                biasCenter={activeUnitCoords}
                placeholder={dict.originPlaceholder}
                clearAddressLabel={dict.clearAddress}
              />
            ) : (
              <input
                type="text"
                value={originInput}
                onChange={(e) => setOriginInput(e.target.value)}
                placeholder={dict.originPlaceholderFallback}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E4002B] focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                <Crosshair className="h-3.5 w-3.5 text-[#E4002B]" />
                {locating ? dict.locating : dict.useMyLocation}
              </button>

              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-neutral-200 px-3.5 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600"
              >
                <Navigation className="h-3.5 w-3.5" />
                {dict.traceRouteBtn}
              </button>
            </div>
          </div>

          {routeSummary && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
              <span className="font-medium">{dict.routeCalculated(travelMode)}</span>
              <span className="font-mono font-semibold tabular-nums">
                {routeSummary.distanceKm} km · ~{routeSummary.durationMin} min
              </span>
            </div>
          )}

          {routeError && (
            <p className="mt-2.5 text-xs font-medium text-[#E4002B]">{routeError}</p>
          )}
        </form>

        {/* Unit Details Cards */}
        <div className="flex flex-col gap-3">
          {visibleUnits.map((unit) => (
            <div
              key={unit.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                    {unit.name}
                  </h4>
                  <p className="mt-0.5 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                    CNPJ {unit.cnpj}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-neutral-900 tabular-nums dark:text-white">
                  {Number(unit.rating ?? 4.8).toFixed(1)}
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-sm text-neutral-600 dark:text-neutral-300">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#E4002B]" />
                  <span>{formatUnitAddress(unit)}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                  <a
                    href={`tel:${(unit.phone || '').replace(/\D/g, '')}`}
                    className="tabular-nums hover:underline"
                  >
                    {unit.phone}
                  </a>
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFocusOnMap(unit.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#E4002B]" />
                  {dict.focusOnMap}
                </button>
                <a
                  href={unit.gmb_url || buildDirectMapsUrl(unit)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {dict.openInMaps}
                </a>
                <a
                  href={buildWhatsAppHref(
                    getUnitWhatsAppNumber(unit),
                    `Olá, Rodaleve ${unit.city}! Gostaria de informações sobre revisão Honda.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1FB858]"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Interactive Google Map */}
      <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 lg:col-span-7">
        {interactiveMapActive ? (
          <>
            {/* Map/Satellite switcher */}
            <div className="absolute left-3 top-3 z-10 inline-flex rounded-xl border border-neutral-200 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
              <button
                type="button"
                onClick={() => setMapTypeId('roadmap')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mapTypeId === 'roadmap'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'text-neutral-700 hover:text-neutral-900 dark:text-neutral-300'
                }`}
              >
                {dict.mapView}
              </button>
              <button
                type="button"
                onClick={() => setMapTypeId('satellite')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mapTypeId === 'satellite'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'text-neutral-700 hover:text-neutral-900 dark:text-neutral-300'
                }`}
              >
                {dict.satelliteView}
              </button>
            </div>

            <div className="h-[460px] w-full flex-1 lg:h-full">
              <GoogleMap
                defaultCenter={activeUnitCoords}
                defaultZoom={16}
                mapId="DEMO_MAP_ID"
                mapTypeId={mapTypeId}
                gestureHandling="greedy"
                disableDefaultUI={false}
                streetViewControl={false}
                mapTypeControl={false}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
              >
                <UnitAddressGeocoder units={safeUnits} onResolved={handleGeocoded} />
                <MapCameraController units={safeUnits} coordsById={coordsById} selectedTab={selectedTab} />
                {originMarkerCoords && (
                  <AdvancedMarker position={originMarkerCoords} title={dict.yourStartPoint}>
                    <Pin
                      background="#16A34A"
                      borderColor="#FFFFFF"
                      glyphColor="#FFFFFF"
                      scale={1.0}
                    />
                  </AdvancedMarker>
                )}
                {safeUnits.map((u) => (
                  <UnitMarker
                    key={u.id}
                    unit={u}
                    position={coordsById[u.id] || { lat: u.lat, lng: u.lng }}
                    isSelected={selectedTab === u.id || (selectedTab === 'both' && u.id === activeUnit.id)}
                    isInfoOpen={infoOpenUnitId === u.id}
                    openInMapsLabel={dict.openInMaps}
                    onSelect={() => {
                      setSelectedTab(u.id);
                      setInfoOpenUnitId(u.id);
                    }}
                    onCloseInfo={() => setInfoOpenUnitId(null)}
                  />
                ))}
                {activeOrigin && activeUnit && (
                  <RouteOverlay
                    origin={activeOrigin}
                    destination={activeUnitCoords}
                    travelMode={travelMode}
                    onRouteResult={handleRouteResult}
                  />
                )}
              </GoogleMap>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center p-8 text-center">
            <MapPin className="h-10 w-10 text-[#E4002B]" />
            <h4 className="mt-3 text-base font-bold text-neutral-900 dark:text-white">
              {dict.directMapsTitle}
            </h4>
            <p className="mt-1 max-w-sm text-sm text-neutral-600 dark:text-neutral-400">
              {dict.directMapsDesc(activeUnit.name, formatUnitAddress(activeUnit))}
            </p>
            <a
              href={activeUnit.gmb_url || buildDirectMapsUrl(activeUnit)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#E4002B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C80024]"
            >
              <ExternalLink className="h-4 w-4" />
              {dict.openCityInMaps(activeUnit.city)}
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section
      id="unidades"
      className="border-t border-neutral-200 bg-white py-16 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {renderEyebrow ? (
              renderEyebrow()
            ) : (
              <p className="text-xs font-bold uppercase tracking-widest text-[#E4002B]">
                Onde estamos
              </p>
            )}
            {renderTitle ? (
              renderTitle()
            ) : (
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                Unidades e Como Chegar
              </h2>
            )}
            {renderSubtitle ? (
              renderSubtitle()
            ) : (
              <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                Localize nossas concessionárias autorizadas em Vitória da Conquista e Guanambi.
              </p>
            )}
          </div>

          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
            {safeUnits.map((u) => {
              const shortCity = u.city || u.name;
              const active = selectedTab === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setSelectedTab(u.id);
                    setInfoOpenUnitId(u.id);
                  }}
                  className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#E4002B] text-white shadow-sm'
                      : 'text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                  }`}
                >
                  {shortCity}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedTab('both')}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                selectedTab === 'both'
                  ? 'bg-[#E4002B] text-white shadow-sm'
                  : 'text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
              }`}
            >
              {dict.viewBothUnits}
            </button>
          </div>
        </div>

        {canRenderInteractiveMap ? (
          <ErrorBoundary
            screenName="Mapa das Unidades"
            onError={(err) => {
              console.error('[UnitsMapSection] Erro no mapa interativo:', err);
              setMapsUnavailable(true);
            }}
            fallback={renderGridContent(false)}
          >
            <APIProvider
              apiKey={mapsApiKey}
              language={(LANGUAGE_META[language] || LANGUAGE_META.pt).htmlLang}
              region="BR"
              libraries={['marker', 'routes', 'geocoding', 'places']}
              onError={() => setMapsUnavailable(true)}
            >
              {renderGridContent(true)}
            </APIProvider>
          </ErrorBoundary>
        ) : (
          renderGridContent(false)
        )}
      </div>
    </section>
  );
}
