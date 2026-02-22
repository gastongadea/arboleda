"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const CONFIG_PASSWORD = "4rb0sg";

type SheetData = {
  retirosProximos: { fecha: string; lugar: string }[];
  mesRetirosLabel: string | null;
  ces: Record<string, string>[];
  crtCv: Record<string, string>[];
  cumpleanosProximos: { nombre: string; fecha: string }[];
  visitCount?: number;
  otrasFechasLink?: string;
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
  const norm = (k: string) => k?.toLowerCase().replace(/\s+/g, "_").replace(/ó/g, "o") ?? "";
  for (const k of keys) {
    const v = obj[norm(k)] ?? obj[k ?? ""];
    if (v) return v;
  }
  return "";
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function parseDateStr(s: string): { day: number; month: number; monthName: string } | null {
  if (!s?.trim()) return null;
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
    return { day: d, month: m - 1, monthName: MESES[m - 1] ?? "" };
  }
  const num = Number(str);
  if (!isNaN(num) && num > 0 && num < 100000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (isNaN(d.getTime())) return null;
    return { day: d.getDate(), month: d.getMonth(), monthName: MESES[d.getMonth()] ?? "" };
  }
  const parts = str.split(/[\/\-\.]/).map((p) => parseInt(p.trim(), 10));
  if (parts.length >= 2) {
    let d: number, m: number;
    if (parts[0] > 31) {
      m = parts[1] - 1;
      d = parts[2] ?? 1;
    } else {
      d = parts[0];
      m = (parts[1] ?? 1) - 1;
    }
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31)
      return { day: d, month: m, monthName: MESES[m] ?? "" };
  }
  return null;
}

function formatDateRange(empieza: string, termina: string): string {
  const ini = parseDateStr(empieza);
  const fin = parseDateStr(termina);
  if (!ini) return termina ? `Fechas: ${termina}` : "—";
  if (!fin) return `Fechas: ${ini.day} de ${ini.monthName}`;
  if (ini.month === fin.month)
    return `Fechas: ${ini.day} al ${fin.day} de ${ini.monthName}`;
  return `Fechas: ${ini.day} de ${ini.monthName} al ${fin.day} de ${fin.monthName}`;
}

function loadData(): Promise<SheetData> {
  return fetch("/api/sheets", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("Error al cargar datos");
      return r.json();
    });
}

export default function Home() {
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configUnlocked, setConfigUnlocked] = useState(false);
  const [configPassword, setConfigPassword] = useState("");
  const [configError, setConfigError] = useState("");

  const refresh = () => {
    setLoading(true);
    setError(null);
    loadData()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError("");
    if (configPassword.trim() === CONFIG_PASSWORD) {
      setConfigUnlocked(true);
      setConfigPassword("");
    } else {
      setConfigError("Clave incorrecta");
    }
  };

  return (
    <main className="relative min-h-screen">
      {/* Botón Configuración */}
      <button
        type="button"
        onClick={() => {
          setConfigOpen(true);
          setConfigUnlocked(false);
          setConfigError("");
          setConfigPassword("");
        }}
        className="fixed right-4 top-4 z-20 rounded-full bg-white/10 p-2.5 text-slate-300 transition hover:bg-white/20 hover:text-white"
        title="Configuración"
        aria-label="Configuración"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Modal Configuración */}
      {configOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfigOpen(false)}>
          <div className="card-glass w-full max-w-sm rounded-xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Configuración</h3>
              <button type="button" onClick={() => setConfigOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            {!configUnlocked ? (
              <form onSubmit={handleConfigSubmit}>
                <label className="block text-sm text-slate-400">Clave de acceso</label>
                <input
                  type="password"
                  value={configPassword}
                  onChange={(e) => setConfigPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none"
                  placeholder="Introduce la clave"
                  autoFocus
                />
                {configError && <p className="mt-2 text-sm text-red-400">{configError}</p>}
                <button type="submit" className="mt-4 w-full rounded-lg bg-green-600 py-2 font-medium text-white hover:bg-green-500">
                  Entrar
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-300">
                  <span className="text-slate-400">Ingresos a la página:</span>{" "}
                  <span className="text-xl font-semibold text-white">{data?.visitCount ?? 0}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    refresh();
                    setConfigOpen(false);
                  }}
                  className="w-full rounded-lg bg-green-600 py-2 font-medium text-white hover:bg-green-500"
                >
                  Actualizar datos (refresh)
                </button>
                <p className="text-xs text-slate-500">
                  Los datos se recargan desde la planilla cada vez que entras o usas este botón.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
            {/* Retiros mensuales (del mes actual o del próximo) */}
            <section className="card-glass p-6 sm:p-8">
              <h2 className="mb-4 text-xl font-semibold text-green-400">
                Retiros mensuales
              </h2>
              {data.retirosProximos.length > 0 ? (
                <>
                  {data.mesRetirosLabel && (
                    <p className="mb-3 text-slate-400">{data.mesRetirosLabel}</p>
                  )}
                  <ul className="space-y-2">
                    {data.retirosProximos.map((item, i) => (
                      <li key={`${item.fecha}-${i}`} className="text-lg text-white">
                        {item.lugar ? (
                          <>
                            <span className="text-slate-300">{item.lugar}</span>
                            {" · "}
                          </>
                        ) : null}
                        {formatDate(item.fecha)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-slate-400">No hay fechas cargadas para los próximos retiros.</p>
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
                  {data.crtCv.map((row, i) => {
                    const empieza = getVal(row, "empieza", "fecha_de_inicio", "fecha_inicio");
                    const termina = getVal(row, "termina", "fecha_de_fin", "fecha_fin");
                    const linkInscripcion = getVal(row, "inscripción", "inscripcion", "link_inscripcion", "link");
                    return (
                      <li
                        key={i}
                        className="rounded-lg border border-white/10 bg-white/5 p-5"
                      >
                        <p className="text-lg font-medium text-white">
                          {getVal(row, "actividad", "tipo_de_actividad", "tipo", "Tipo de actividad") || "Actividad"}
                        </p>
                        <p className="mt-1 text-slate-300">
                          <span className="text-slate-400">Lugar:</span> {getVal(row, "lugar", "Lugar") || "—"}
                        </p>
                        <p className="mt-1 text-slate-300">
                          {formatDateRange(empieza, termina)}
                        </p>
                        <p className="mt-1 text-slate-300">
                          <span className="text-slate-400">Sacerdote:</span> {getVal(row, "sacerdote", "predicador", "Predicador") || "—"}
                        </p>
                        <p className="mt-1 text-slate-300">
                          <span className="text-slate-400">Director:</span> {getVal(row, "director", "Director") || "—"}
                        </p>
                        {linkInscripcion ? (
                          <a
                            href={linkInscripcion.startsWith("http") ? linkInscripcion : `https://${linkInscripcion}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-inscripcion mt-4 inline-flex"
                          >
                            Inscripción
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {data.otrasFechasLink ? (
                <a
                  href={data.otrasFechasLink.startsWith("http") ? data.otrasFechasLink : `https://${data.otrasFechasLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-inscripcion mt-6 inline-flex"
                >
                  Otras fechas
                </a>
              ) : null}
            </section>

            {/* Cumpleaños próximos 30 días */}
            <section className="card-glass p-6 sm:p-8">
              <h2 className="mb-4 text-xl font-semibold text-green-400">
                Cumpleaños (próximos 30 días)
              </h2>
              {data.cumpleanosProximos.length === 0 ? (
                <p className="text-slate-400">No hay cumpleaños en los próximos 30 días.</p>
              ) : (
                <ul className="space-y-3">
                  {data.cumpleanosProximos.map((item, i) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const esHoy = item.fecha === today;
                    return (
                      <li
                        key={i}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 ${esHoy ? "bg-green-900/40 ring-1 ring-green-500/50" : ""}`}
                      >
                        <span className={esHoy ? "font-semibold text-white" : "text-white"}>
                          {item.nombre}
                          {esHoy && (
                            <span className="ml-2 rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                              Hoy
                            </span>
                          )}
                        </span>
                        <span className="text-slate-400">{formatDate(item.fecha)}</span>
                      </li>
                    );
                  })}
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
