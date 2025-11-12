import { NextResponse } from "next/server";
import { loadFeatureData } from "@/lib/data";

export async function GET() {
  const data = await loadFeatureData();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

