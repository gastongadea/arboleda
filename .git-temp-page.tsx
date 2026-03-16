"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const CONFIG_PASSWORD = "4rb0sg";

const SECTION_IDS = ["misas", "retiros", "ces", "crt", "cumples", "recursos"] as const;
const SECTION_LABELS: Record<(typeof SECTION_IDS)[number], string> = {
  misas: "Misas en el campus",
  retiros: "Retiros mensuales",
  ces: "C├¡rculos de estudio",
  crt: "Actividades del a├▒o",
  cumples: "Cumplea├▒os",
  recursos: "Recursos",
};

const VISIBILITY_KEY = "arboleda-section-visibility";

const DEFAULT_VISIBILITY: Record<(typeof SECTION_IDS)[number], boolean> = {
  misas: true,
  retiros: true,
  ces: true,
  crt: true,
  cumples: true,
  recursos: true,
};

function loadSectionVisibility(): Record<(typeof SECTION_IDS)[number], boolean> {
  if (typeof window === "undefined") return DEFAULT_VISIBILITY;
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<(typeof SECTION_IDS)[number], boolean>>;
      return { ...DEFAULT_VISIBILITY, ...parsed };
    }
  } catch {}
  return DEFAULT_VISIBILITY;
}

type MisasPorDia = {
  fecha: string;
  diaLabel?: string;
  misas: { lugar: string; horarios: string[] }[];
};

type SheetData = {
  retirosProximos: { fecha: string; lugar: string }[];
  mesRetirosLabel: string | null;
  ces: Record<string, string>[];
  crtCv: Record<string, string>[];
  cumpleanosProximos: { nombre: string; fecha: string }[];
  visitCount?: number;
  otrasFechasLink?: string;
  misasCampus?: MisasPorDia[];
  recursos?: Record<string, string>[];
};

/** Fecha de hoy en GMT-3 (Argentina) para que "hoy" no cambie a las 21h por UTC. */
function getTodayGMT3(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
}

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
  const norm = (k: string) => k?.toLowerCase().replace(/\s+/g, "_").replace(/├│/g, "o") ?? "";
  for (const k of keys) {
    const v = obj[norm(k)] ?? obj[k ?? ""];
    if (v) return v;
  }
  return "";
}

/** Convierte enlace de Google Drive (file/d/ID/view) a URL de miniatura para usar en <img>. */
function imageUrlForRecurso(url: string): string {
  if (!url?.trim()) return "";
  const m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}`;
  return url;
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
  if (!ini) return termina ? `Fechas: ${termina}` : "ΓÇö";
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
  const [openSections, setOpenSections] = useState({
    misas: false,
    retiros: false,
    ces: false,
    crt: false,
    cumples: false,
    recursos: false,
  });
  const [sectionVisibility, setSectionVisibility] = useState<Record<(typeof SECTION_IDS)[number], boolean>>({
    misas: true,
    retiros: true,
    ces: true,
    crt: true,
    cumples: true,
    recursos: true,
  });

  useEffect(() => {
    setSectionVisibility(loadSectionVisibility());
  }, []);

  const setSectionVisible = (id: (typeof SECTION_IDS)[number], visible: boolean) => {
    const next = { ...sectionVisibility, [id]: visible };
    setSectionVisibility(next);
    try {
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next));
    } catch {}
  };

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

  const toggleSection = (id: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
      {/* Bot├│n Configuraci├│n */}
      <button
        type="button"
        onClick={() => {
          setConfigOpen(true);
          setConfigUnlocked(false);
          setConfigError("");
          setConfigPassword("");
        }}
        className="fixed right-4 top-4 z-20 rounded-full bg-white/10 p-2.5 text-slate-300 transition hover:bg-white/20 hover:text-white"
        title="Configuraci├│n"
        aria-label="Configuraci├│n"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Modal Configuraci├│n */}
      {configOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfigOpen(false)}>
          <div className="card-glass w-full max-w-sm rounded-xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Configuraci├│n</h3>
              <button type="button" onClick={() => setConfigOpen(false)} className="text-slate-400 hover:text-white">Γ£ò</button>
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
                  <span className="text-slate-400">Ingresos a la p├ígina:</span>{" "}
                  <span className="text-xl font-semibold text-white">{data?.visitCount ?? 0}</span>
                </p>
                <div>
                  <p className="mb-2 text-sm text-slate-400">Mostrar u ocultar secciones</p>
                  <ul className="space-y-2">
                    {SECTION_IDS.map((id) => (
                      <li key={id} className="flex items-center justify-between gap-2">
                        <label className="cursor-pointer text-sm text-white">
                          {SECTION_LABELS[id]}
                        </label>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={sectionVisibility[id]}
                          onClick={() => setSectionVisible(id, !sectionVisibility[id])}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                            sectionVisibility[id] ? "bg-green-600" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              sectionVisibility[id] ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
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
                  Los datos se recargan desde la planilla cada vez que entras o usas este bot├│n.
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
              Revisa GOOGLE_SERVICE_ACCOUNT_JSON y que la planilla est├⌐ compartida con el email de la cuenta de servicio.
            </p>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-8">
            {/* Misas en el Campus (desde austral.edu.ar/capellania) */}
            {sectionVisibility.misas && (
              <section
                className={`card-glass transition-all duration-200 ${
                  !openSections.misas ? "py-2 sm:py-2 px-6 sm:px-8" : "p-6 sm:p-8 sm:py-4"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection("misas")}
                  className="mb-2 flex w-full items-center justify-between text-left"
                >
                  <h2 className="text-xl font-semibold text-green-400">
                    Misas
                  </h2>
                  <span
                    className={`transform text-slate-300 transition-transform ${
                      openSections.misas ? "rotate-180" : ""
                    }`}
                  >
                    Γû╝
                  </span>
                </button>
                {openSections.misas && (
                  <>
                    {(data.misasCampus ?? []).length > 0 ? (
                      <ul className="space-y-5">
                        {(data.misasCampus ?? []).map((dia, i) => (
                          <li key={i} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
                            <p className="mb-2 font-medium text-green-300/90">
                              {dia.fecha}
                            </p>
                            <ul className="space-y-2">
                              {dia.misas.map((m, j) => (
                                <li key={j} className="text-white">
                                  {m.lugar && <span className="font-medium text-white">{m.lugar}</span>}
                                  {m.horarios.length > 0 && (
                                    <span className="text-slate-300">
                                      {m.lugar ? " ΓÇö " : ""}
                                      {m.horarios.join(", ")}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-400">No se pudieron cargar las misas.</p>
                    )}
                    <p className="mt-4">
                      <a
                        href="https://www.austral.edu.ar/capellania/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-300 hover:text-green-200"
                      >
                        Ir a la web de Capellan├¡a Γåù
                      </a>
                    </p>
                  </>
                )}
              </section>
            )}

            {/* Retiros mensuales (del mes actual o del pr├│ximo) */}
            {sectionVisibility.retiros && (
            <section
              className={`card-glass transition-all duration-200 ${
                !openSections.retiros ? "py-2 sm:py-2 px-6 sm:px-8" : "p-6 sm:p-8"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection("retiros")}
                className="mb-2 flex w-full items-center justify-between text-left"
              >
                <h2 className="text-xl font-semibold text-green-400">
                  Retiros mensuales
                </h2>
                <span
                  className={`transform text-slate-300 transition-transform ${
                    openSections.retiros ? "rotate-180" : ""
                  }`}
                >
                  Γû╝
                </span>
              </button>
              {openSections.retiros &&
                (data.retirosProximos.length > 0 ? (
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
                              {" ┬╖ "}
                            </>
                          ) : null}
                          {formatDate(item.fecha)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-slate-400">No hay fechas cargadas para los pr├│ximos retiros.</p>
                ))}
            </section>
            )}

            {/* C├¡rculos de estudio (semanal) */}
            {sectionVisibility.ces && (
            <section
              className={`card-glass transition-all duration-200 ${
                !openSections.ces ? "py-2 sm:py-2 px-6 sm:px-8" : "p-6 sm:p-8"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection("ces")}
                className="mb-2 flex w-full items-center justify-between text-left"
              >
                <h2 className="text-xl font-semibold text-green-400">
                  C├¡rculos de estudio
                </h2>
                <span
                  className={`transform text-slate-300 transition-transform ${
                    openSections.ces ? "rotate-180" : ""
                  }`}
                >
                  Γû╝
                </span>
              </button>
              {openSections.ces &&
                (data.ces.length === 0 ? (
                  <p className="text-slate-400">No hay c├¡rculos cargados.</p>
                ) : (
                  <ul className="space-y-4">
                    {data.ces.map((row, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-white/10 pb-3 last:border-0 last:pb-0"
                      >
                        <span className="font-medium text-white">
                          {getVal(row, "lugar", "Lugar") || "ΓÇö"}
                        </span>
                        <span className="text-slate-300">
                          {getVal(row, "d├¡a", "dia", "D├¡a") || "ΓÇö"}
                        </span>
                        <span className="text-slate-300">
                          {getVal(row, "hora", "Hora") || "ΓÇö"}
                        </span>
                        <span className="text-slate-400">
                          Encargado: {getVal(row, "encargado", "Encargado") || "ΓÇö"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}
            </section>
            )}

            {/* Actividades del a├▒o (CRT-CV) */}
            {sectionVisibility.crt && (
            <section
              className={`card-glass transition-all duration-200 ${
                !openSections.crt ? "py-2 sm:py-2 px-6 sm:px-8" : "p-6 sm:p-8"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection("crt")}
                className="mb-2 flex w-full items-center justify-between text-left"
              >
                <h2 className="text-xl font-semibold text-green-400">
                  Actividades del a├▒o
                </h2>
                <span
                  className={`transform text-slate-300 transition-transform ${
                    openSections.crt ? "rotate-180" : ""
                  }`}
                >
                  Γû╝
                </span>
              </button>
              {openSections.crt &&
                (data.crtCv.length === 0 ? (
                  <p className="text-slate-400">No hay actividades cargadas.</p>
                ) : (
                  <ul className="space-y-5">
                    {data.crtCv.map((row, i) => {
                      const empieza = getVal(row, "empieza", "fecha_de_inicio", "fecha_inicio");
                      const termina = getVal(row, "termina", "fecha_de_fin", "fecha_fin");
                      const linkInscripcion = getVal(row, "inscripci├│n", "inscripcion", "link_inscripcion", "link");
                      return (
                        <li
                          key={i}
                          className="rounded-lg border border-white/10 bg-white/5 p-5"
                        >
                          <p className="text-lg font-medium text-white">
                            {getVal(row, "actividad", "tipo_de_actividad", "tipo", "Tipo de actividad") || "Actividad"}
                          </p>
                          <p className="mt-1 text-slate-300">
                            <span className="text-slate-400">Lugar:</span> {getVal(row, "lugar", "Lugar") || "ΓÇö"}
                          </p>
                          <p className="mt-1 text-slate-300">
                            {formatDateRange(empieza, termina)}
                          </p>
                          <p className="mt-1 text-slate-300">
                            <span className="text-slate-400">Sacerdote:</span> {getVal(row, "sacerdote", "predicador", "Predicador") || "ΓÇö"}
                          </p>
                          <p className="mt-1 text-slate-300">
                            <span className="text-slate-400">Director:</span> {getVal(row, "director", "Director") || "ΓÇö"}
                          </p>
                          {linkInscripcion ? (
                            <a
                              href={linkInscripcion.startsWith("http") ? linkInscripcion : `https://${linkInscripcion}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-inscripcion mt-4 inline-flex"
                            >
                              Inscripci├│n
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ))}
              {openSections.crt && data.otrasFechasLink ? (
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
            )}

            {/* Cumplea├▒os pr├│ximos 30 d├¡as */}
            {sectionVisibility.cumples && (
            <section
              className={`card-glass transition-all duration-200 ${
                !openSections.cumples ? "py-2 sm:py-2 px-6 sm:px-8" : "p-6 sm:p-8"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection("cumples")}
                className="mb-2 flex w-full items-center justify-between text-left"
              >
                <h2 className="text-xl font-semibold text-green-400">
                  Cumplea├▒os (30 d├¡as)
                </h2>
                <span
                  className={`transform text-slate-300 transition-transform ${
                    openSections.cumples ? "rotate-180" : ""
                  }`}
                >
                  Γû╝
                </span>
              </button>
              {/* Siempre mostrar los cumplea├▒os de hoy, incluso con la secci├│n cerrada */}
              {data.cumpleanosProximos.length > 0 && (
                <ul className="mb-2 space-y-2">
                  {data.cumpleanosProximos.map((item, i) => {
                    const today = getTodayGMT3();
                    if (item.fecha !== today) return null;
                    return (
                      <li
                        key={`hoy-${i}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-green-900/40 px-3 py-2 ring-1 ring-green-500/50"
                      >
                        <span className="font-semibold text-white">
                          {item.nombre}
                          <span className="ml-2 rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                            Hoy
                          </span>
                        </span>
                        <span className="text-slate-400">{formatDate(item.fecha)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {openSections.cumples &&
                (data.cumpleanosProximos.length === 0 ? (
                  <p className="text-slate-400">No hay cumplea├▒os en los pr├│ximos 30 d├¡as.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.cumpleanosProximos.map((item, i) => {
                      const today = getTodayGMT3();
                      const esHoy = item.fecha === today;
                      return (
                        <li
                          key={i}
                          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 ${esHoy ? "bg-green-900/20 ring-1 ring-green-500/30" : ""}`}
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
                ))}
            </section>
            )}

            {/* Recursos */}
            {sectionVisibility.recursos && (
            <section
              className={`card-glass transition-all duration-200 ${
                !openSections.recursos ? "py-2 sm:py-2 px-6 sm:px-8" : "p-6 sm:p-8"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection("recursos")}
                className="mb-2 flex w-full items-center justify-between text-left"
              >
                <h2 className="text-xl font-semibold text-green-400">
                  Recursos
                </h2>
                <span
                  className={`transform text-slate-300 transition-transform ${
                    openSections.recursos ? "rotate-180" : ""
                  }`}
                >
                  Γû╝
                </span>
              </button>
              {openSections.recursos &&
                (data.recursos && data.recursos.length > 0 ? (
                  <ul className="space-y-4">
                    {data.recursos.map((row, i) => {
                      const titulo = getVal(row, "T├¡tulo");
                      const link = getVal(row, "Link");
                      const imagen = getVal(row, "Imagen");
                      if (!titulo) return null;
                      const href = link ? (link.startsWith("http") ? link : `https://${link}`) : null;
                      return (
                        <li key={i} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                          {imagen && (
                            <img
                              src={imageUrlForRecurso(imagen)}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-300 hover:text-green-200"
                            >
                              {titulo}
                            </a>
                          ) : (
                            <span className="text-white">{titulo}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-slate-400">No hay recursos cargados.</p>
                ))}
            </section>
            )}
          </div>
        )}

        <footer className="mt-12 text-center text-sm text-slate-500">
          Datos desde Google Sheets ┬╖ Arboleda
        </footer>
      </div>
    </main>
  );
}
