import { NextResponse } from "next/server";
import { loadFeatureData } from "@/lib/data";

// Força rota dinâmica para evitar pré-renderização (arquivo muito grande)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cache em memória para evitar ler o arquivo múltiplas vezes
let featuresCache: Awaited<ReturnType<typeof loadFeatureData>> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

export async function GET() {
  try {
    const now = Date.now();
    
    // Retorna cache se ainda válido
    if (featuresCache && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json(featuresCache, {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
          "Content-Type": "application/json",
        },
      });
    }

    // Carrega dados do arquivo
    const data = await loadFeatureData();
    featuresCache = data;
    cacheTimestamp = now;

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Erro ao carregar features:", error);
    return NextResponse.json(
      { error: "Erro ao carregar dados" },
      { status: 500 }
    );
  }
}

