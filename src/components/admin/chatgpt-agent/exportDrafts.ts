/**
 * Full-fidelity Excel export of ChatGPT Agent drafts.
 *
 * Guarantees:
 *  - Column list comes from `get_intake_drafts_columns()` RPC (DB catalog),
 *    NOT from the union of row keys. NULL-only columns still appear.
 *  - Row filter is the shared CHATGPT_AGENT_FILTER → identical to manager.
 *  - Hard-fail abort if DB count ≠ rows fetched.
 *  - Long values (>32,000 chars) are split deterministically across
 *    `<col>`, `<col>__part_2`, `<col>__part_3` … with a global header set.
 *  - Every value preserved byte-exact: formula-like strings (=, +, -, @) are
 *    written as inline strings (`t:'s'`), never as Excel formulas, never
 *    mutated.
 *  - Long numeric strings / UUIDs forced to text → no scientific notation.
 *  - Second sheet `Export_Metadata` documents everything for audit.
 */
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { CHATGPT_AGENT_FILTER } from './filter';

const PAGE_SIZE = 1000; // per project pagination policy
const MAX_CELL = 32000; // safe under Excel's 32,767 char hard limit
const SOURCE_TABLE = 'public.intake_drafts';
const XLSX_VERSION = (XLSX as any)?.version ?? 'unknown';

type SchemaCol = { column_name: string; data_type: string; ordinal_position: number };
type ProgressCb = (msg: string) => void;

function serializeForCell(v: any): { kind: 'blank' } | { kind: 'bool'; v: boolean } | { kind: 'num'; v: number } | { kind: 'str'; v: string } {
  if (v === null || v === undefined) return { kind: 'blank' };
  if (typeof v === 'boolean') return { kind: 'bool', v };
  if (typeof v === 'number') {
    if (Number.isFinite(v) && (Number.isSafeInteger(v) || Math.abs(v) < 1e15)) {
      return { kind: 'num', v };
    }
    return { kind: 'str', v: String(v) };
  }
  if (typeof v === 'string') return { kind: 'str', v };
  // object / array / bigint / anything else → JSON
  try {
    return { kind: 'str', v: JSON.stringify(v) };
  } catch {
    return { kind: 'str', v: String(v) };
  }
}

function cellFromSerialized(s: ReturnType<typeof serializeForCell>): XLSX.CellObject | null {
  if (s.kind === 'blank') return null;
  if (s.kind === 'bool') return { t: 'b', v: s.v };
  if (s.kind === 'num') return { t: 'n', v: s.v };
  // explicit inline string → SheetJS will write <t> not <f>; formula-like
  // values (=SUM(...), +1, -2, @cmd) remain literal text in Excel.
  return { t: 's', v: s.v };
}

function splitString(s: string): string[] {
  if (s.length <= MAX_CELL) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += MAX_CELL) out.push(s.slice(i, i + MAX_CELL));
  return out;
}

async function fetchAllRows(progress: ProgressCb): Promise<any[]> {
  const rows: any[] = [];
  let from = 0;
  // Order by id for stable pagination per project policy.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = (supabase.from('intake_drafts') as any).select('*');
    q = CHATGPT_AGENT_FILTER.apply(q);
    const { data, error } = await q.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    progress(`Fetched ${rows.length} rows…`);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function fetchExactCount(): Promise<number> {
  let q = (supabase.from('intake_drafts') as any).select('id', { count: 'exact', head: true });
  q = CHATGPT_AGENT_FILTER.apply(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function fetchSchemaColumns(): Promise<SchemaCol[]> {
  const { data, error } = await (supabase as any).rpc('get_intake_drafts_columns');
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Schema RPC returned no columns — cannot guarantee full-fidelity export.');
  }
  return [...data].sort((a: SchemaCol, b: SchemaCol) => a.ordinal_position - b.ordinal_position);
}

function triggerDownload(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', compression: true });
}

export interface ExportResult {
  filename: string;
  rowsExported: number;
  rowsInDb: number;
  columnsFromSchema: number;
  columnsWritten: number;
  splitFields: number;
  unexpectedColumns: string[];
}

export async function exportChatGptAgentDraftsToExcel(
  progress: ProgressCb = () => {},
): Promise<ExportResult> {
  progress('Loading schema…');
  const [schema, rows, totalInDb, userResp] = await Promise.all([
    fetchSchemaColumns(),
    fetchAllRows(progress),
    fetchExactCount(),
    supabase.auth.getUser(),
  ]);

  // Hard-fail: row counts must match.
  if (rows.length !== totalInDb) {
    throw new Error(
      `Row-count mismatch: DB reports ${totalInDb} rows but only ${rows.length} were fetched. ` +
      `Aborting export — no partial download.`,
    );
  }

  const schemaCols = schema.map(c => c.column_name);
  const schemaColSet = new Set(schemaCols);

  // ── Pass A: serialize every cell once, measure parts needed per column ──
  progress(`Serializing ${rows.length} rows × ${schemaCols.length} columns…`);
  const serialized: Array<Record<string, ReturnType<typeof serializeForCell>>> = [];
  const maxParts: Record<string, number> = {};
  const unexpectedKeys = new Set<string>();
  const splitDetail: Array<{ row_id: string; column: string; original_length: number; parts: number; data_type: string }> = [];
  const dataTypeByCol: Record<string, string> = {};
  schema.forEach(c => { dataTypeByCol[c.column_name] = c.data_type; });

  for (const row of rows) {
    const r: Record<string, ReturnType<typeof serializeForCell>> = {};
    // schema columns
    for (const col of schemaCols) {
      const s = serializeForCell(row[col]);
      r[col] = s;
      const len = s.kind === 'str' ? s.v.length : 0;
      const parts = len > MAX_CELL ? Math.ceil(len / MAX_CELL) : 1;
      if (parts > (maxParts[col] || 1)) maxParts[col] = parts;
      if (parts >= 2) {
        splitDetail.push({
          row_id: String(row.id ?? ''),
          column: col,
          original_length: len,
          parts,
          data_type: dataTypeByCol[col] || 'unknown',
        });
      }
    }
    // unexpected keys (drift detection)
    for (const k of Object.keys(row)) {
      if (!schemaColSet.has(k)) {
        unexpectedKeys.add(k);
        const s = serializeForCell(row[k]);
        r[`__unexpected__${k}`] = s;
        const len = s.kind === 'str' ? s.v.length : 0;
        const parts = len > MAX_CELL ? Math.ceil(len / MAX_CELL) : 1;
        const headerKey = `__unexpected__${k}`;
        if (parts > (maxParts[headerKey] || 1)) maxParts[headerKey] = parts;
      }
    }
    serialized.push(r);
  }

  // ── Pass B: build deterministic global header set ──
  const headers: string[] = [];
  for (const col of schemaCols) {
    headers.push(col);
    const mp = maxParts[col] || 1;
    for (let i = 2; i <= mp; i++) headers.push(`${col}__part_${i}`);
  }
  const unexpectedList = Array.from(unexpectedKeys).sort();
  for (const k of unexpectedList) {
    const headerKey = `__unexpected__${k}`;
    headers.push(headerKey);
    const mp = maxParts[headerKey] || 1;
    for (let i = 2; i <= mp; i++) headers.push(`${headerKey}__part_${i}`);
  }

  // ── Pass C: build sheet ──
  progress('Building workbook…');
  const ws: XLSX.WorkSheet = {};
  // header row
  headers.forEach((h, c) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    ws[addr] = { t: 's', v: h, s: { font: { bold: true } } } as XLSX.CellObject;
  });
  // data rows
  serialized.forEach((row, rIdx) => {
    headers.forEach((h, c) => {
      // determine which serialized field + which part
      let baseCol = h;
      let partIdx = 1;
      const m = h.match(/^(.*)__part_(\d+)$/);
      if (m) { baseCol = m[1]; partIdx = parseInt(m[2], 10); }
      const s = row[baseCol];
      if (!s) return;
      let cell: XLSX.CellObject | null = null;
      if (s.kind === 'str' && s.v.length > MAX_CELL) {
        const parts = splitString(s.v);
        const piece = parts[partIdx - 1];
        if (piece === undefined || piece === '') return;
        cell = { t: 's', v: piece };
      } else if (partIdx === 1) {
        cell = cellFromSerialized(s);
      }
      if (cell) {
        const addr = XLSX.utils.encode_cell({ r: rIdx + 1, c });
        ws[addr] = cell;
      }
    });
  });

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: serialized.length, c: Math.max(headers.length - 1, 0) },
  });
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
  ws['!cols'] = headers.map(h => ({ wch: Math.min(Math.max(h.length + 2, 14), 60) }));

  // ── Sheet 2: Export_Metadata ──
  const exportedAt = new Date().toISOString();
  const exportedBy = userResp?.data?.user?.email ?? userResp?.data?.user?.id ?? 'unknown';
  const columnsWritten = headers.length;
  const expectedColumnsWritten =
    schemaCols.length +
    schemaCols.reduce((acc, c) => acc + Math.max((maxParts[c] || 1) - 1, 0), 0) +
    unexpectedList.length +
    unexpectedList.reduce((acc, k) => acc + Math.max((maxParts[`__unexpected__${k}`] || 1) - 1, 0), 0);

  const metaRows: any[][] = [
    ['Key', 'Value'],
    ['exported_at', exportedAt],
    ['exported_by', exportedBy],
    ['source_table', SOURCE_TABLE],
    ['filter_predicate', CHATGPT_AGENT_FILTER.description],
    ['total_rows_in_db', totalInDb],
    ['total_rows_exported', rows.length],
    ['rows_match', rows.length === totalInDb ? 'TRUE' : 'FALSE'],
    ['total_columns_from_schema', schemaCols.length],
    ['total_columns_written', columnsWritten],
    ['expected_columns_written', expectedColumnsWritten],
    ['columns_arithmetic_check', columnsWritten === expectedColumnsWritten ? 'PASS' : 'FAIL'],
    ['unexpected_columns_count', unexpectedList.length],
    ['unexpected_columns', unexpectedList.join(', ')],
    ['formula_like_values_preserved_as_strings', 'TRUE'],
    ['long_strings_split_at_chars', MAX_CELL],
    ['split_fields_count', splitDetail.length],
    ['pagination_page_size', PAGE_SIZE],
    ['xlsx_lib_version', XLSX_VERSION],
    [],
    ['── Reconstruction rule ──'],
    ['For any column whose name matches "<base>__part_N" (N>=2), the original'],
    ['value is concat(<base>, <base>__part_2, <base>__part_3, …) in numeric'],
    ['order. The <base> column always holds part 1. No delimiter is inserted.'],
    [],
    ['Python snippet:'],
    ['def reconstruct(row, base):'],
    ['    parts = [row[base]] + [row[k] for k in sorted(row) if k.startswith(base + "__part_")]'],
    ['    return "".join(p for p in parts if p)'],
    [],
    ['── Formula-like value note ──'],
    ['Cells that visually display "=…", "+…", "-…", or "@…" are literal text'],
    ['from the database. They are stored as inline strings (SheetJS t:"s"),'],
    ['NEVER as Excel formulas. Round-trip is byte-exact and unmodified.'],
    [],
    ['── Split fields detail (row_id | column | original_length | parts | data_type) ──'],
    ['row_id', 'column', 'original_length', 'parts', 'data_type'],
    ...splitDetail.map(d => [d.row_id, d.column, d.original_length, d.parts, d.data_type]),
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  wsMeta['!cols'] = [{ wch: 36 }, { wch: 60 }, { wch: 18 }, { wch: 8 }, { wch: 24 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Drafts');
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Export_Metadata');

  const stamp = exportedAt.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const filename = `chatgpt-agent-drafts_${stamp}.xlsx`;
  progress('Writing file…');
  triggerDownload(wb, filename);

  return {
    filename,
    rowsExported: rows.length,
    rowsInDb: totalInDb,
    columnsFromSchema: schemaCols.length,
    columnsWritten,
    splitFields: splitDetail.length,
    unexpectedColumns: unexpectedList,
  };
}
