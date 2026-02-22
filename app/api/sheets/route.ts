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
  const rows = (res.data.values ?? []) as unknown[][];
  return rows.map((row) => (row ?? []).map((c) => String(c != null && c !== "" ? c : "").trim()));
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

function parseDate(s: string | number): Date | null {
  if (s === "" || s == null) return null;
  const str = String(s).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + "T12:00:00");
  const num = Number(str);
  if (!isNaN(num) && num > 0 && num < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + num * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = str.split(/[\/\-\.]/).map((p) => parseInt(p.trim(), 10));
  if (parts.length >= 2) {
    let d: number, m: number, y: number;
    if (parts.length === 2) {
      d = parts[0];
      m = parts[1];
      y = new Date().getFullYear();
    } else {
      if (parts[0] > 31) {
        y = parts[0];
        m = parts[1];
        d = parts[2];
      } else if (parts[2] > 31) {
        d = parts[0];
        m = parts[1];
        y = parts[2];
      } else {
        d = parts[0];
        m = parts[1];
        y = parts[2];
      }
      if (y != null && y < 100) y = 2000 + y;
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y ?? new Date().getFullYear(), m - 1, d);
      return isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

type RetiroItem = { fecha: string; lugar: string };

/**
 * Hoja "rt": A = Lugar, B a L = meses (febrero a diciembre).
 * Filas 2 a 8 = datos; cada celda en B-L es una fecha completa (ej. "5/2/2026", "9/3/2026").
 * Celdas vacías = no hay retiro en ese mes para esa fila.
 */
async function getRetirosMensuales(): Promise<RetiroItem[]> {
  const rows = await getSheetValues("rt!A:L");
  const items: RetiroItem[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const lugar = (row[0] ?? "").trim();
    for (let c = 1; c <= 11; c++) {
      const raw = row[c];
      const cell = raw != null ? String(raw).trim() : "";
      if (!cell) continue;
      const d = parseDate(cell);
      if (d) items.push({ fecha: d.toISOString().slice(0, 10), lugar });
    }
  }
  return items.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Retiros del mes actual (próximos) o del próximo mes si ya pasaron todos los del actual. */
function getRetirosProximosDelMes(retiros: RetiroItem[], today: string): RetiroItem[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  const inMonth = (fecha: string, y: number, m: number) => {
    const [yy, mm] = fecha.split("-").map(Number);
    return yy === y && mm === m + 1;
  };

  const retirosEsteMes = retiros.filter((x) => inMonth(x.fecha, currentYear, currentMonth));
  const retirosProximoMes = retiros.filter((x) => inMonth(x.fecha, nextYear, nextMonth));
  const futurosEsteMes = retirosEsteMes.filter((x) => x.fecha >= today);

  if (futurosEsteMes.length > 0) return futurosEsteMes;
  return retirosProximoMes;
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
      getSheetValues("Cumples!A:B"),
    ]);

    let crtCv = rowsToObjects(crtCvRows);
    const ces = rowsToObjects(cesRows);
    let cumpleanos = rowsToObjects(cumpleanosRows);
    if (cumpleanos.length === 0 && cumpleanosRows.length >= 1) {
      const header = (cumpleanosRows[0] ?? []).map((h) => String(h).toLowerCase().replace(/\s+/g, "_"));
      const nameIdx = header.findIndex((h) => /full_name|nombre|name|nom/.test(h)) >= 0
        ? header.findIndex((h) => /full_name|nombre|name|nom/.test(h))
        : 0;
      const dateIdx = header.findIndex((h) => /nacimiento|fecha|birth/.test(h)) >= 0
        ? header.findIndex((h) => /nacimiento|fecha|birth/.test(h))
        : 1;
      cumpleanos = cumpleanosRows.slice(1).map((row) => ({
        nombre: (row[nameIdx] ?? "").trim() || (row[0] ?? "").trim(),
        fecha: (row[dateIdx] ?? "").trim() || (row[1] ?? "").trim(),
      }));
      cumpleanos = cumpleanos.filter((r) => r.nombre || r.fecha);
    }

    const today = new Date().toISOString().slice(0, 10);

    crtCv = crtCv.filter((row) => {
      const fin = (row.termina ?? row.fecha_de_fin ?? row.fecha_fin ?? "").trim();
      if (!fin) return true;
      const d = parseDate(fin);
      if (!d) return true;
      return d.toISOString().slice(0, 10) >= today;
    });

    const retirosProximos = getRetirosProximosDelMes(retiros, today);

    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const end = in30Days.toISOString().slice(0, 10);

    const getNombre = (row: Record<string, string>) =>
      row.full_name ?? row.nombre ?? row.name ?? row.nom ?? "";
    const getFechaNac = (row: Record<string, string>) =>
      row.nacimiento ?? row.fecha ?? row.fecha_de_nacimiento ?? row.fecha_nacimiento ?? "";

    const cumpleanosProximos = cumpleanos
      .map((row) => {
        const nombre = getNombre(row).trim();
        const fechaRaw = getFechaNac(row);
        const d = parseDate(fechaRaw);
        if (!d || !nombre) return null;
        const thisYear = new Date(new Date().getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
        if (thisYear >= today && thisYear <= end) return { nombre, fecha: thisYear };
        return null;
      })
      .filter((x): x is { nombre: string; fecha: string } => x != null)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const mesRetirosLabel =
      retirosProximos.length > 0
        ? (() => {
            const [y, m] = retirosProximos[0].fecha.split("-").map(Number);
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            return `${monthNames[m - 1]} ${y}`;
          })()
        : null;

    return NextResponse.json({
      retirosProximos,
      mesRetirosLabel,
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
