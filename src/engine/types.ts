export type ColType =
  | { kind: 'int' }
  | { kind: 'double'; virgule: boolean }
  | { kind: 'bool' }
  | { kind: 'date'; format: string }
  | { kind: 'timestamp'; format: string }
  | { kind: 'text' };

export interface ColumnInfo {
  name: string;
  type: ColType;
}

export interface Dataset {
  fileName: string;
  sheet: string | null;
  rows: number;
  columns: ColumnInfo[];
  hasHeader: boolean;
  loadMs: number;
}

export interface TypeOption {
  id: string;
  label: string;
  type: ColType;
}

export const TYPE_OPTIONS: TypeOption[] = [
  { id: 'text', label: 'Texte', type: { kind: 'text' } },
  { id: 'int', label: 'Entier', type: { kind: 'int' } },
  { id: 'double', label: 'Décimal (point)', type: { kind: 'double', virgule: false } },
  { id: 'double_virgule', label: 'Décimal (virgule)', type: { kind: 'double', virgule: true } },
  { id: 'bool', label: 'Booléen', type: { kind: 'bool' } },
  { id: 'date_iso', label: 'Date AAAA-MM-JJ', type: { kind: 'date', format: '%Y-%m-%d' } },
  { id: 'date_jma', label: 'Date JJ/MM/AAAA', type: { kind: 'date', format: '%d/%m/%Y' } },
  { id: 'date_mja', label: 'Date MM/JJ/AAAA', type: { kind: 'date', format: '%m/%d/%Y' } },
  { id: 'date_jma_tiret', label: 'Date JJ-MM-AAAA', type: { kind: 'date', format: '%d-%m-%Y' } },
  { id: 'ts_iso', label: 'Date et heure AAAA-MM-JJ hh:mm:ss', type: { kind: 'timestamp', format: '%Y-%m-%d %H:%M:%S' } },
  { id: 'ts_iso_t', label: 'Date et heure AAAA-MM-JJThh:mm:ss', type: { kind: 'timestamp', format: '%Y-%m-%dT%H:%M:%S' } },
  { id: 'ts_jma', label: 'Date et heure JJ/MM/AAAA hh:mm:ss', type: { kind: 'timestamp', format: '%d/%m/%Y %H:%M:%S' } },
  { id: 'ts_jma_court', label: 'Date et heure JJ/MM/AAAA hh:mm', type: { kind: 'timestamp', format: '%d/%m/%Y %H:%M' } },
];

export function typeId(type: ColType): string {
  const found = TYPE_OPTIONS.find((o) => sameType(o.type, type));
  return found ? found.id : 'text';
}

export function sameType(a: ColType, b: ColType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'double' && b.kind === 'double') return a.virgule === b.virgule;
  if ((a.kind === 'date' || a.kind === 'timestamp') && (b.kind === 'date' || b.kind === 'timestamp')) {
    return a.format === b.format;
  }
  return true;
}

export function typeLabel(type: ColType): string {
  return TYPE_OPTIONS.find((o) => sameType(o.type, type))?.label ?? 'Texte';
}

export const isNumeric = (t: ColType) => t.kind === 'int' || t.kind === 'double';
export const isTemporal = (t: ColType) => t.kind === 'date' || t.kind === 'timestamp';
