"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CircleMarker,
  FeatureGroup,
  GeoJSON,
  LayerGroup,
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import clsx from "clsx";
import { renderToString } from "react-dom/server";
import { getServiceIconMeta } from "@/lib/serviceIcons";
import type { GeoJsonObject } from "geojson";
import type { FeatureCollection, FeatureRecord } from "@/lib/types";
import type * as Leaflet from "leaflet";

let LeafletLib: typeof Leaflet | undefined;

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LeafletLib = require("leaflet");
}

type MapViewProps = {
  data: FeatureCollection;
};

const { BaseLayer, Overlay } = LayersControl;

function normalizePopup(html?: string | null): string | undefined {
  if (!html) return undefined;
  return html.replace(/<table/g, "<table class='w-full text-sm'");
}

export function MapView({ data }: MapViewProps) {
  const L = LeafletLib;
  const mapRef = useRef<Leaflet.Map | null>(null);
  const iconCache = useRef<Map<string, Leaflet.DivIcon>>(new Map());
  const searchMarkerRef = useRef<Leaflet.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [boundaryData, setBoundaryData] = useState<GeoJsonObject | null>(null);

  const searchMarkerIcon = useMemo<Leaflet.DivIcon | null>(() => {
    if (!L) {
      return null;
    }
    const html = renderToString(
      <div className="flex h-8 w-8 items-center justify-center">
        <svg
          className="h-8 w-8 drop-shadow-md"
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="search-pin-gradient" x1="50%" x2="50%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <path
            fill="url(#search-pin-gradient)"
            d="M16 29c-.58 0-1.14-.25-1.53-.68C12.9 26.61 6 18.93 6 12a10 10 0 1 1 20 0c0 6.93-6.9 14.61-8.47 16.32-.39.43-.95.68-1.53.68Z"
          />
          <circle cx="16" cy="12" r="4.5" fill="#fff" />
          <circle cx="16" cy="12" r="2.5" fill="#ea580c" />
        </svg>
      </div>,
    );
    return L.divIcon({
      html,
      className: "map-marker-icon search-marker-icon",
      iconSize: [32, 32],
      iconAnchor: [16, 30],
      popupAnchor: [0, -28],
    });
  }, [L]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (map && searchMarkerRef.current) {
        map.removeLayer(searchMarkerRef.current);
        searchMarkerRef.current = null;
      }
    };
  }, []);

  const placeSearchMarker = useCallback(
    (position: Leaflet.LatLngExpression, popupText?: string) => {
      const map = mapRef.current;
      if (!map || !L || !searchMarkerIcon) {
        return;
      }
      if (searchMarkerRef.current) {
        map.removeLayer(searchMarkerRef.current);
        searchMarkerRef.current = null;
      }
      const marker = L.marker(position, { icon: searchMarkerIcon }).addTo(map);
      if (popupText) {
        marker.bindPopup(popupText).openPopup();
      }
      searchMarkerRef.current = marker;
    },
    [searchMarkerIcon],
  );

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    const timer = setTimeout(() => mapRef.current?.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSearchOpen]);

  useEffect(() => {
    const controller = new AbortController();
    const loadBoundary = async () => {
      try {
        const response = await fetch(
          "https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-35-mun.json",
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const geojson = (await response.json()) as GeoJSON.GeoJsonObject & {
          features?: Array<{ properties?: Record<string, unknown> }>;
        };
        if ("features" in geojson && Array.isArray(geojson.features)) {
          geojson.features = geojson.features.filter((feature) => {
            const props = feature.properties ?? {};
            const rawName =
              (props.NM_MUN as string | undefined) ??
              (props.name as string | undefined) ??
              "";
            const nameUpper = rawName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            return nameUpper === "SAO PAULO";
          });
        }
        setBoundaryData(geojson);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Falha ao carregar limite municipal de São Paulo:", error);
        }
      }
    };
    loadBoundary();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!L) {
      return undefined;
    }
    const Icon = L.Icon.Default.prototype as L.Icon & {
      _getIconUrl?: string;
    };

    if (Icon && !Icon._getIconUrl) {
      Icon.options.iconUrl =
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
      Icon.options.iconRetinaUrl =
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
      Icon.options.shadowUrl =
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
    }
  }, [L]);

  useEffect(() => {
    let geocoder: Leaflet.Control | undefined;
    let cancelled = false;

    const map = mapRef.current;
    if (!map || !L) {
      return undefined;
    }

    const loadGeocoder = async () => {
      if (typeof window === "undefined") return;

      try {
        await import("leaflet-control-geocoder/dist/Control.Geocoder.js");
        if (cancelled) return;

        // @ts-expect-error - plugin adds geocoder to the control namespace
        const control = L.Control.geocoder({
          defaultMarkGeocode: false,
          placeholder: "Pesquisar endereço...",
        })
          .on("markgeocode", (event: any) => {
            const center = event.geocode.center as Leaflet.LatLng;
            const label = event.geocode.name ?? "Endereço";
            map.setView(center, 17);
            placeSearchMarker(center, label);
          })
          .addTo(map);

        geocoder = control;
      } catch (error) {
        console.warn("Não foi possível inicializar o geocoder:", error);
      }
    };

    loadGeocoder();

    return () => {
      cancelled = true;
      if (geocoder && mapRef.current) {
        mapRef.current.removeControl(geocoder);
      }
    };
  }, [L, placeSearchMarker]);

  const handleSearch = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isSearchOpen) {
        setIsSearchOpen(true);
        return;
      }
      const query = searchQuery.trim();
      if (!query || !mapRef.current || !L) {
        return;
      }
      setIsSearching(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({
          format: "json",
          q: query,
          limit: "1",
          addressdetails: "0",
        });
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`,
          {
            headers: {
              "Accept-Language": "pt-BR",
            },
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const results: Array<{
          lat: string;
          lon: string;
          display_name?: string;
        }> = await response.json();
        if (results.length === 0) {
          setSearchError("Endereço não encontrado.");
          return;
        }
        const result = results[0];
        const lat = Number(result.lat);
        const lon = Number(result.lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          setSearchError("Coordenadas inválidas retornadas pela busca.");
          return;
        }
        const destination = L.latLng(lat, lon);
        const map = mapRef.current;
        if (map) {
          map.flyTo(destination, 18, { duration: 0.75 });
        }
        placeSearchMarker(destination, result.display_name || "Endereço encontrado.");
      } catch (error) {
        console.warn("Erro ao buscar endereço:", error);
        setSearchError("Não foi possível realizar a busca agora.");
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery, placeSearchMarker, isSearchOpen, L],
  );

  const bounds = useMemo(() => {
    if (!L) {
      return null;
    }
    if (data.bounds) {
      return L.latLngBounds(
        [data.bounds.minLat, data.bounds.minLon],
        [data.bounds.maxLat, data.bounds.maxLon],
      );
    }

    const points: [number, number][] = [];
    Object.values(data.services).forEach((features) => {
      features.forEach((feature) => {
        points.push(...feature.coords);
      });
    });

    if (points.length === 0) {
      return null;
    }

    return L.latLngBounds(points);
  }, [data, L]);

  const services = useMemo(
    () => Object.entries(data.services).filter(([, features]) => features.length > 0),
    [data.services],
  );

  const mapCenter = useMemo(() => data.center ?? [-23.55052, -46.633308], [data.center]);

  const getMarkerIcon = useCallback(
    (feature: FeatureRecord): Leaflet.DivIcon | null => {
      const key =
        feature.service_icon ??
        feature.service_type_code ??
        feature.service_type ??
        "default";
      if (!L) {
        return null;
      }
      if (!iconCache.current.has(key)) {
        const iconMeta = getServiceIconMeta(key);
        const html = renderToString(
          <div
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 shadow-sm backdrop-blur",
              iconMeta.bgClass ?? "bg-white/95",
            )}
          >
            {iconMeta.element}
          </div>,
        );
        const icon = L.divIcon({
          html,
          className: "map-marker-icon",
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -30],
        });
        iconCache.current.set(key, icon);
      }
      return iconCache.current.get(key)!;
    },
    [L],
  );

  const renderBaseLayerLabel = useCallback(
    (icon: string, label: string) =>
      renderToString(
        <span className="layer-label-text">
              <span className="layer-label-emoji">{icon}</span>
              <span>{label}</span>
        </span>,
      ),
    [],
  );

  const renderOverlayLabel = useCallback(
    (serviceKey: string, displayName: string, sample?: FeatureRecord) => {
      const iconKey =
        sample?.service_icon ??
        sample?.service_type_code ??
        sample?.service_type ??
        serviceKey;
      const iconMeta = getServiceIconMeta(iconKey);
      return renderToString(
        <span className="layer-label-text">
          <span
            className={clsx(
              "layer-service-icon",
              iconMeta.bgClass ?? "bg-white",
            )}
          >
            {iconMeta.element}
          </span>
          <span>{displayName}</span>
        </span>,
      );
    },
    [],
  );

  const wrapperClass = clsx(
    "relative flex flex-1 w-full flex-col overflow-hidden border-t border-slate-200 bg-black",
  );

  const mapWrapperClass = "flex-1 h-full w-full bg-black";
  const mapClass = "h-full w-full bg-black";

  const actionBarClass = clsx(
    "absolute left-20 right-6 top-3 z-[1300] flex flex-wrap items-center gap-2 ",
  );

  const searchErrorClass = clsx(
    "absolute left-6 top-24 z-[1300] max-w-md rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow",
  );

  if (!L) {
    return <div className={wrapperClass} />;
  }

  return (
    <div className={wrapperClass}>
      <div className={actionBarClass}>
        <button
          type="button"
          onClick={() => setIsSearchOpen((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/80 bg-primary/10 text-primary transition hover:bg-primary/20"
          aria-label={isSearchOpen ? "Fechar busca" : "Abrir busca"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={clsx(
              "h-5 w-5 transition-transform duration-200",
              isSearchOpen ? "scale-105" : "scale-100",
            )}
          >
            <path
              fillRule="evenodd"
              d="M10.5 3a7.5 7.5 0 1 1 4.756 13.354l3.195 3.195a.75.75 0 1 1-1.06 1.06l-3.195-3.194A7.5 7.5 0 0 1 10.5 3Zm-6 7.5a6 6 0 1 1 12 0a6 6 0 0 1-12 0Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <form
          onSubmit={handleSearch}
          className={clsx(
            "flex items-center gap-2 overflow-hidden rounded-lg border border-slate-300 bg-white/95 px-0 py-1.5 shadow-inner transition-all duration-200",
            isSearchOpen
              ? "w-[360px] px-3 opacity-100"
              : "pointer-events-none w-0 border-transparent opacity-0",
          )}
        >
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Pesquisar endereço..."
            className={clsx(
              "flex-1 rounded-md border-none bg-transparent text-sm text-slate-700 focus:outline-none focus:ring-0",
              isSearchOpen ? "pr-2" : "w-0",
            )}
            aria-hidden={!isSearchOpen}
            ref={searchInputRef}
          />
          <button
            type="submit"
            disabled={isSearching || !isSearchOpen}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white uppercase tracking-wide shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearching ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </div>

      {searchError && (
        <div className={searchErrorClass}>
          {searchError}
        </div>
      )}

      <div className={mapWrapperClass}>
        <MapContainer
          center={mapCenter as [number, number]}
          zoom={13}
          className={mapClass}
          style={{ width: "100%", height: "100%" }}
          ref={(instance) => {
            if (instance) {
              mapRef.current = instance;
              if (bounds) {
                instance.fitBounds(bounds, { padding: [24, 24] });
              }
            }
          }}
        >
          <LayersControl position="topright" collapsed={false}>
            <BaseLayer
              checked
              name={renderBaseLayerLabel("🗺️", "CartoDB Positron")}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
            </BaseLayer>
            <BaseLayer name={renderBaseLayerLabel("🛰️", "Satélite (Esri)")}>
              <TileLayer
                attribution='Imagery &copy; <a href="https://www.esri.com/">Esri</a>'
                url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </BaseLayer>
            <BaseLayer name={renderBaseLayerLabel("🛰️", "Satélite + Ruas (Esri)")}>
              <LayerGroup>
                <TileLayer
                  attribution='Imagery &copy; <a href="https://www.esri.com/">Esri</a>'
                  url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <TileLayer
                  attribution='Ruas &copy; <a href="https://www.esri.com/">Esri</a>'
                  url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                  opacity={0.75}
                />
                <TileLayer
                  attribution='Limites &copy; <a href="https://www.esri.com/">Esri</a>'
                  url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_And_Places/MapServer/tile/{z}/{y}/{x}"
                  opacity={0.7}
                />
              </LayerGroup>
            </BaseLayer>

            {services.map(([serviceKey, features]) => {
              const lineFeatures = features.filter(
                (feature: FeatureRecord) => (feature.geometry ?? "polygon") === "line",
              );
              const pointFeatures = features.filter(
                (feature: FeatureRecord) => (feature.geometry ?? "polygon") === "point",
              );
              const polygonFeatures = features.filter(
                (feature: FeatureRecord) =>
                  (feature.geometry ?? "polygon") === "polygon",
              );
              const displayName =
                features[0]?.serviceDisplay ?? features[0]?.service ?? serviceKey;

              return (
                <Overlay
                  key={serviceKey}
                  name={renderOverlayLabel(serviceKey, displayName, features[0])}
                >
                  <FeatureGroup>
                    {lineFeatures.map((feature: FeatureRecord) => {
                      const color = feature.lineColor || feature.fillColor || "#1f6feb";
                      const weight = feature.lineWidth || 3;
                      return (
                        <Polyline
                          key={`${feature.service}-${feature.setor}-line`}
                          positions={feature.coords}
                          pathOptions={{
                            color,
                            weight,
                            opacity: 0.9,
                          }}
                        >
                          {normalizePopup(feature.popupHtml) && (
                            <Popup>
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: normalizePopup(feature.popupHtml) ?? "",
                                }}
                              />
                            </Popup>
                          )}
                        </Polyline>
                      );
                    })}

                    {polygonFeatures.map((feature: FeatureRecord) => (
                      <Polygon
                        key={`${feature.service}-${feature.setor}`}
                        positions={feature.coords}
                        pathOptions={{
                          color: feature.fillColor || "#1f6feb",
                          weight: feature.lineWidth || 2,
                          fillOpacity: 0.35,
                        }}
                      >
                        {normalizePopup(feature.popupHtml) && (
                          <Popup>
                            <div
                              dangerouslySetInnerHTML={{
                                __html: normalizePopup(feature.popupHtml) ?? "",
                              }}
                            />
                          </Popup>
                        )}
                      </Polygon>
                    ))}

                    {polygonFeatures.map((feature: FeatureRecord) => (
                      <Marker
                        key={`${feature.service}-${feature.setor}-marker`}
                        position={feature.centroid}
                        icon={(() => {
                          const icon = getMarkerIcon(feature);
                          return icon ?? undefined;
                        })()}
                      >
                        {normalizePopup(feature.popupHtml) && (
                          <Popup>
                            <div
                              dangerouslySetInnerHTML={{
                                __html: normalizePopup(feature.popupHtml) ?? "",
                              }}
                            />
                          </Popup>
                        )}
                      </Marker>
                    ))}

                    {pointFeatures.map((feature: FeatureRecord) => {
                      if (!feature.coords?.length) {
                        return null;
                      }
                      const [lat, lon] = feature.coords[0];
                      const color = feature.fillColor || "#1f6feb";
                      return (
                        <CircleMarker
                          key={`${feature.service}-${feature.setor}-point`}
                          center={[lat, lon]}
                          pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.9,
                            weight: 2,
                          }}
                          radius={7}
                        >
                          {normalizePopup(feature.popupHtml) && (
                            <Popup>
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: normalizePopup(feature.popupHtml) ?? "",
                                }}
                              />
                            </Popup>
                          )}
                        </CircleMarker>
                      );
                    })}
                  </FeatureGroup>
                </Overlay>
              );
            })}
            {boundaryData && (
              <Overlay
                key="boundary"
                name={renderOverlayLabel("boundary", "Limite Municipal (São Paulo)", undefined)}
                checked
              >
                <FeatureGroup>
                  <GeoJSON
                    data={boundaryData}
                    style={() => ({
                      color: "#374151",
                      weight: 2.5,
                      dashArray: "5 4",
                      fillOpacity: 0,
                    })}
                  />
                </FeatureGroup>
              </Overlay>
            )}
          </LayersControl>
        </MapContainer>
      </div>
      <style jsx global>{`
        .leaflet-control-layers {
          background: rgba(17, 24, 39, 0.88);
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 18px 40px -24px rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(6px);
          color: #f8fafc;
        }
        .leaflet-control-layers-expanded {
          padding: 12px 16px;
          width: 260px;
        }
        .leaflet-control-layers-list {
          overflow-y: auto;
          max-height: 320px;
          padding-right: 2px;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .leaflet-control-layers-list::-webkit-scrollbar {
          display: none;
        }
        .leaflet-control-layers-base label,
        .leaflet-control-layers-overlays label {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 4px 0;
          padding: 6px 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .leaflet-control-layers-base label:hover,
        .leaflet-control-layers-overlays label:hover {
          background: rgba(148, 163, 184, 0.15);
          transform: translateX(2px);
        }
        .layer-label-text {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: #f8fafc;
          font-size: 0.85rem;
          line-height: 1.1;
        }
        .layer-label-emoji {
          display: inline-flex;
          font-size: 1.2rem;
          line-height: 1;
        }
        .layer-service-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          overflow: hidden;
        }
        .layer-service-icon svg {
          width: 1rem;
          height: 1rem;
        }
        .leaflet-control-layers-selector {
          transform: scale(1.05);
          margin-right: 6px;
          accent-color: #2563eb;
        }
        .leaflet-control-layers-separator {
          border-top: 1px solid rgba(148, 163, 184, 0.35);
          margin: 10px -4px;
        }
      `}</style>
    </div>
  );
}

