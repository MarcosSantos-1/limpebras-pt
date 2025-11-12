export type FeatureRecord = {
  service: string;
  serviceDisplay?: string | null;
  setor: string;
  name: string;
  subprefeitura?: string | null;
  turno?: string | null;
  frequencia?: string | null;
  cronograma?: string | null;
  logradouro?: string | null;
  service_type?: string | null;
  service_type_code?: string | null;
  service_icon?: string | null;
  coords: [number, number][];
  centroid: [number, number];
  fillColor: string;
  lineColor?: string | null;
  lineWidth?: number | null;
  geometry?: "polygon" | "line" | "point";
  popupHtml?: string;
  volumetria?: string | null;
};

export type FeatureCollection = {
  services: Record<string, FeatureRecord[]>;
  center: [number, number];
  bounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } | null;
};

