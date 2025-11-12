import nextDynamic from "next/dynamic";
import { loadFeatureData } from "@/lib/data";

const MapView = nextDynamic(
  () => import("@/components/MapView").then((mod) => mod.MapView),
  { ssr: false },
);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const data = await loadFeatureData();

  return (
    <main className="flex min-h-screen w-full flex-col overflow-hidden bg-white">
      <header className="mx-auto w-full max-w-5xl space-y-2 px-6 py-8">
        <p className="text-xs uppercase tracking-widest text-primary">
          Plano de Trabalho
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">
          Visualize os serviços NH, LE, VP, LF e PV em um painel interativo
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Use o mapa para ativar camadas específicas, pesquisar endereços e
          explorar cada área com os detalhes completos do cronograma.
        </p>
      </header>

      <div className="flex flex-1 min-h-[calc(100vh-160px)]">
        <MapView data={data} />
      </div>
    </main>
  );
}
