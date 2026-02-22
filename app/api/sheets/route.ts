import { google } from "googleapis";
import { NextResponse } from "next/server";

const SPREADSHEET_ID = process.env.SHEET_ID || "1KD20URgHePrH-4Hb6Z_eSxMhqF6xpMlX4uS8oWEvofc";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON");
  let credentials: object;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido");
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return auth;
}

async function getSheetValues(range: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  const rows = (res.data.values ?? []) as string[][];
  return rows.map((row) => row.map((c) => String(c ?? "").trim()));
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => {
      obj[h] = (row[j] ?? "").trim();
    });
    if (Object.values(obj).some((v) => v)) out.push(obj);
  }
  return out;
}

function parseMonth(label: string): number {
  const m: Record<string, number> = {
    enero: 0, ene: 0, february: 1, febrero: 1, feb: 1, marzo: 2, mar: 2, abril: 3, abr: 3,
    mayo: 4, junio: 5, jun: 5, julio: 6, jul: 6, agosto: 7, ago: 7, septiembre: 8, sep: 8, sept: 8,
    octubre: 9, oct: 9, noviembre: 10, nov: 10, diciembre: 11, dic: 11,
  };
  const key = label.toLowerCase().trim();
  return m[key] ?? m[key.slice(0, 3)] ?? -1;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T12:00:00");
  const [d, m, y] = s.split(/[\/\-]/).map(Number);
  if (!d || !m) return null;
  const year = y != null ? (y < 100 ? 2000 + y : y) : new Date().getFullYear();
  const month = m >= 1 && m <= 12 ? m - 1 : -1;
  if (month < 0) return null;
  const date = new Date(year, month, d);
  return isNaN(date.getTime()) ? null : date;
}

/** Hoja "rt": columnas = meses, filas = fechas. Devuelve lista de fechas. */
async function getRetirosMensuales(): Promise<string[]> {
  const rows = await getSheetValues("rt!A:Z");
  const dates: string[] = [];
  for (let r = 1; r < rows.length; r++) {
    for (let c = 0; c < (rows[r]?.length ?? 0); c++) {
      const cell = (rows[r][c] ?? "").trim();
      if (!cell) continue;
      const num = parseInt(cell, 10);
      if (!isNaN(num) && num >= 1 && num <= 31 && rows[0]?.[c]) {
        const monthLabel = (rows[0][c] ?? "").trim();
        const year = new Date().getFullYear();
        const month = parseMonth(monthLabel);
        if (month >= 0) {
          const d = new Date(year, month, num);
          if (!isNaN(d.getTime())) dates.push(d.toISOString().slice(0, 10));
        }
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(cell) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cell)) {
        const d = parseDate(cell);
        if (d) dates.push(d.toISOString().slice(0, 10));
      }
    }
  }
  return [...new Set(dates)].sort();
}

export async function GET() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      { error: "Configura GOOGLE_SERVICE_ACCOUNT_JSON (cuenta de servicio de Google)." },
      { status: 503 }
    );
  }

  try {
    const [retiros, crtCvRows, cesRows, cumpleanosRows] = await Promise.all([
      getRetirosMensuales(),
      getSheetValues("crt-cv!A:Z"),
      getSheetValues("ces!A:Z"),
      getSheetValues("'cumpleaños'!A:Z"),
    ]);

    const crtCv = rowsToObjects(crtCvRows);
    const ces = rowsToObjects(cesRows);
    const cumpleanos = rowsToObjects(cumpleanosRows);

    const today = new Date().toISOString().slice(0, 10);
    const proximoRetiro = retiros.find((d) => d >= today) ?? null;

    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const end = in30Days.toISOString().slice(0, 10);
    const cumpleanosProximos = cumpleanos
      .map((row) => {
        const nombre = row.nombre ?? row.name ?? "";
        const fecha = row.fecha ?? row.fecha_de_nacimiento ?? row["fecha de nacimiento"] ?? "";
        const d = parseDate(fecha);
        if (!d || !nombre) return null;
        const thisYear = new Date(new Date().getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
        if (thisYear >= today && thisYear <= end) return { nombre, fecha: thisYear };
        return null;
      })
      .filter((x): x is { nombre: string; fecha: string } => x != null)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    return NextResponse.json({
      proximoRetiro,
      ces,
      crtCv,
      cumpleanosProximos,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          "No se pudo leer la planilla. Revisa que la cuenta de servicio tenga acceso (comparte la hoja con su email).",
      },
      { status: 502 }
    );
  }
}
