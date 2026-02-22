"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type SheetData = {
  proximoRetiro: string | null;
  ces: Record<string, string>[];
  crtCv: Record<string, string>[];
  cumpleanosProximos: { nombre: string; fecha: string }[];
};

function formatDate(s: string): string {
  if (!s) return "";
  const d = new Date(s + "T12:00:00");
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getVal(obj: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k?.toLowerCase().replace(/\s+/g, "_") ?? ""] ?? obj[k ?? ""];
    if (v) return v;
  }
  return "";
}

export default function Home() {
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sheets")
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar datos");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="relative min-h-screen">
      {/* Fondo con imagen (coloca arboleda.png en /public) */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-slate-900" />
        <Image
          src="/arboleda.png"
          alt=""
          fill
          className="object-cover opacity-40"
          priority
          sizes="100vw"
          unoptimized
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute inset-0 hero-backdrop" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl">
            Arboleda
          </h1>
          <p className="mt-2 text-lg text-slate-300">Actividades y retiros</p>
        </header>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="card-glass mb-6 rounded-xl p-6 text-center text-red-300">
            <p>{error}</p>
            <p className="mt-2 text-sm text-slate-400">
              Revisa GOOGLE_SERVICE_ACCOUNT_JSON y que la planilla esté compartida con el email de la cuenta de servicio.
            </p>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-8">
            {/* Próximo retiro mensual */}
            <section className="card-glass p-6 sm:p-8">
              <h2 className="mb-4 text-xl font-semibold text-green-400">
                Próximo retiro mensual
              </h2>
              {data.proximoRetiro ? (
                <p className="text-2xl text-white">
                  {formatDate(data.proximoRetiro)}
                </p>
              ) : (
                <p className="text-slate-400">No hay fecha cargada para el próximo retiro.</p>
              )}
            </section>

            {/* Círculos de estudio (semanal) */}
            <section className="card-glass p-6 sm:p-8">
              <h2 className="mb-4 text-xl font-semibold text-green-400">
                Círculos de estudio
              </h2>
              {data.ces.length === 0 ? (
                <p className="text-slate-400">No hay círculos cargados.</p>
              ) : (
                <ul className="space-y-4">
                  {data.ces.map((row, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-white/10 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="font-medium text-white">
                        {getVal(row, "lugar", "Lugar") || "—"}
                      </span>
                      <span className="text-slate-300">
                        {getVal(row, "día", "dia", "Día") || "—"}
                      </span>
                      <span className="text-slate-300">
                        {getVal(row, "hora", "Hora") || "—"}
                      </span>
                      <span className="text-slate-400">
                        Encargado: {getVal(row, "encargado", "Encargado") || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Actividades del año (CRT-CV) */}
            <section className="card-glass p-6 sm:p-8">
              <h2 className="mb-4 text-xl font-semibold text-green-400">
                Actividades del año (Curso de Retiro y Convivencia)
              </h2>
              {data.crtCv.length === 0 ? (
                <p className="text-slate-400">No hay actividades cargadas.</p>
              ) : (
                <ul className="space-y-5">
                  {data.crtCv.map((row, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-green-900/50 px-2 py-0.5 text-sm text-green-300">
                          {getVal(row, "tipo_de_actividad", "tipo", "Tipo de actividad") || "Actividad"}
                        </span>
                        <span className="text-slate-300">
                          {getVal(row, "lugar", "Lugar") || ""}
                        </span>
                      </div>
                      <p className="mt-2 text-white">
                        {getVal(row, "fecha_de_inicio", "fecha_inicio", "Fecha de inicio")}
                        {getVal(row, "fecha_de_fin", "fecha_fin", "Fecha de fin")
                          ? ` – ${getVal(row, "fecha_de_fin", "fecha_fin", "Fecha de fin")}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Predicador: {getVal(row, "predicador", "Predicador") || "—"}
                        {" · "}
                        Director: {getVal(row, "director", "Director") || "—"}
                      </p>
                      {getVal(row, "link_inscripción", "link_inscripcion", "link", "Link de inscripción") && (
                        <a
                          href={getVal(row, "link_inscripción", "link_inscripcion", "link", "Link de inscripción")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-inscripcion mt-3"
                        >
                          Inscripción
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Cumpleaños próximos 30 días */}
            <section className="card-glass p-6 sm:p-8">
              <h2 className="mb-4 text-xl font-semibold text-green-400">
                Cumpleaños (próximos 30 días)
              </h2>
              {data.cumpleanosProximos.length === 0 ? (
                <p className="text-slate-400">No hay cumpleaños en los próximos 30 días.</p>
              ) : (
                <ul className="space-y-2">
                  {data.cumpleanosProximos.map((item, i) => (
                    <li key={i} className="flex justify-between gap-4 text-white">
                      <span>{item.nombre}</span>
                      <span className="text-slate-400">{formatDate(item.fecha)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <footer className="mt-12 text-center text-sm text-slate-500">
          Datos desde Google Sheets · Arboleda
        </footer>
      </div>
    </main>
  );
}
