import { promises as fs } from "fs";
import path from "path";
import type { FeatureCollection } from "./types";

const DEFAULT_DATA_PATH = path.join(process.cwd(), "data", "features.json");
const SAMPLE_DATA_PATH = path.join(process.cwd(), "data", "features.sample.json");

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function loadFeatureData(): Promise<FeatureCollection> {
  const sourcePath = process.env.FEATURES_JSON_PATH ?? DEFAULT_DATA_PATH;

  const data =
    (await readJsonFile<FeatureCollection>(sourcePath)) ??
    (await readJsonFile<FeatureCollection>(SAMPLE_DATA_PATH));

  if (!data) {
    return {
      services: {},
      center: [-23.55052, -46.633308],
      bounds: null,
      addressIndex: [],
    };
  }

  // Remove addressIndex do payload principal para reduzir tamanho
  // O addressIndex será carregado apenas na API route
  const { addressIndex, ...rest } = data;

  return {
    ...rest,
    addressIndex: [], // Não carrega no cliente para reduzir tamanho
  };
}

