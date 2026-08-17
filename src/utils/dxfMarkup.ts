import DxfParser from 'dxf-parser';
import type { StressData } from './stressCalculations';

export interface DxfEntity {
  type: string;
  layer?: string;
  text?: string;
  textHeight?: number;
  position?: { x: number; y: number; z?: number };
  vertices?: Array<{ x: number; y: number; z?: number }>;
  startPoint?: { x: number; y: number; z?: number };
  endPoint?: { x: number; y: number; z?: number };
  center?: { x: number; y: number; z?: number };
  radius?: number;
}

export interface DxfHit {
  id: string;
  section: string;
  label: string;
  top: number;
  bot: number;
  sig: number;
  ast: number;
  sp: number;
  spRound: number;
  provide: string;
  bbox?: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface ProcessedDxf {
  fileName: string;
  entities: DxfEntity[];
  viewBox: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  hits: DxfHit[];
  markedDxfString: string;
}

/**
 * Cleans MTEXT control codes, formatting tags, and linebreaks from CAD text
 */
export function cleanMtext(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\f[^;]*;/gi, '')    // \fArial;
    .replace(/\\A[0-2];/gi, '')     // \A1;
    .replace(/\\H[0-9.]*x?;/gi, '')// \H1.5x;
    .replace(/\\W[0-9.]*;/gi, '')   // \W0.9;
    .replace(/\\Q[0-9.-]*;/gi, '')  // \Q0;
    .replace(/\\C[0-9]*;/gi, '')    // \C7;
    .replace(/\\P/gi, ' ')          // \P (newline)
    .replace(/[{}]/g, '')          // Braces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes strip IDs for matching
 */
export function normalizeLabel(text: string): string {
  return cleanMtext(text).toUpperCase().replace(/[^A-Z0-9-()]/g, '');
}

/**
 * Multi-tier matching logic to pair DXF drawing text entities with calculation table failure rows
 */
export function matchRowToDxfLabel(row: StressData, rawDxfText: string): { score: number } | null {
  const cleanLabel = cleanMtext(rawDxfText).toUpperCase();
  const normLabel = normalize(cleanLabel);
  if (!normLabel) return null;

  const baseLabel = normLabel.split('(')[0]; // "10-1(2)" -> "10-1"

  const normId = normalize(row.id);
  const normSec = normalize(row.section);
  const combo1 = `${normId}-${normSec}`;
  const combo2 = `${normId}_${normSec}`;

  // Strip C/SEC prefixes: "1C-2" -> "1-2", "1C" -> "1"
  const cleanId = normId.replace(/C/g, '').replace(/SEC/g, '');
  const cleanCombo = `${cleanId}-${normSec}`;

  // Strategy 1: Exact Match
  if (normLabel === normId || normLabel === combo1 || normLabel === combo2) {
    return { score: 100 };
  }

  // Strategy 2: Base label match (ignoring parentheticals like 10-1(2) or 62-1(3))
  if (baseLabel === normId || baseLabel === combo1 || baseLabel === cleanCombo) {
    return { score: 90 };
  }

  // Strategy 3: Cleaned ID prefix match (1C-2 -> 1-2)
  if (normLabel === cleanCombo || normLabel === cleanId) {
    return { score: 80 };
  }

  // Strategy 4: Word token matching
  const labelTokens = normLabel.split(/[-_\s()]+/);
  if (labelTokens.includes(normId) || (normSec && labelTokens.includes(normId) && labelTokens.includes(normSec))) {
    return { score: 70 };
  }

  return null;
}

/**
 * Parse DXF text content and extract visual entities & matched failed strip zones
 */
export function processDxfFile(
  dxfString: string,
  fileName: string,
  stressRows: StressData[],
  barDia: number = 12,
  stressLimit: number = 3.5
): ProcessedDxf {
  const parser = new DxfParser();
  let dxfData: any;
  try {
    dxfData = parser.parseSync(dxfString);
  } catch (err: any) {
    throw new Error(`Failed to parse DXF file "${fileName}": ${err.message}`);
  }

  const rawEntities: DxfEntity[] = dxfData?.entities || [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const updateBounds = (x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  };

  // 1. Calculate overall bounding box of drawing
  for (const ent of rawEntities) {
    if (ent.type === 'LINE' && ent.startPoint && ent.endPoint) {
      updateBounds(ent.startPoint.x, ent.startPoint.y);
      updateBounds(ent.endPoint.x, ent.endPoint.y);
    } else if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices) {
      for (const v of ent.vertices) {
        updateBounds(v.x, v.y);
      }
    } else if ((ent.type === 'TEXT' || ent.type === 'MTEXT') && ent.position) {
      updateBounds(ent.position.x, ent.position.y);
    }
  }

  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 1000; maxY = 1000;
  }

  // Padding
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const padX = width * 0.05;
  const padY = height * 0.05;

  const viewBox = `${minX - padX} ${minY - padY} ${width + padX * 2} ${height + padY * 2}`;

  // 2. Map stress failure rows by checking stress limit and failure status
  const failRows = stressRows.filter(
    r => Number(r.topStress) > stressLimit || 
         Number(r.bottomStress) > stressLimit || 
         r.status === 'Fail' ||
         Math.max(Number(r.topStress), Number(r.bottomStress)) > stressLimit
  );
  
  const hitsMap = new Map<string, DxfHit>();

  // Search text entities to match IDs
  for (const ent of rawEntities) {
    if ((ent.type === 'TEXT' || ent.type === 'MTEXT') && ent.text && ent.position) {
      const rawText = ent.text;

      // Find matching failure row using multi-tier matcher
      for (const matchedRow of failRows) {
        const matchResult = matchRowToDxfLabel(matchedRow, rawText);
        if (matchResult) {
          const key = `${matchedRow.id}_${matchedRow.section}_${ent.position.x}_${ent.position.y}`;
          if (!hitsMap.has(key)) {
            const govSig = Math.max(Number(matchedRow.topStress), Number(matchedRow.bottomStress));
            const spRound = Math.floor(matchedRow.spacingOfBar / 25) * 25;
            const h = (ent.textHeight || 250) * 1.5;
            const w = (ent.textHeight || 250) * 4.0;

            hitsMap.set(key, {
              id: matchedRow.id,
              section: matchedRow.section,
              label: cleanMtext(rawText),
              top: matchedRow.topStress,
              bot: matchedRow.bottomStress,
              sig: govSig,
              ast: matchedRow.astReq,
              sp: matchedRow.spacingOfBar,
              spRound,
              provide: `T${matchedRow.diameter || barDia} @ ${spRound}`,
              bbox: {
                minX: ent.position.x - w / 2,
                minY: ent.position.y - h / 2,
                maxX: ent.position.x + w / 2,
                maxY: ent.position.y + h / 2,
              }
            });
          }
        }
      }
    }
  }

  const hits = Array.from(hitsMap.values());

  // 3. Generate AutoCAD-compliant marked-up DXF string
  const markedDxfString = generateMarkedDxf(dxfString, hits);

  return {
    fileName,
    entities: rawEntities,
    viewBox,
    bounds: { minX, minY, maxX, maxY },
    hits,
    markedDxfString,
  };
}

/**
 * Generates AutoCAD-compliant DXF markup with PT-TENSILE-FAIL layer
 */
function generateMarkedDxf(originalDxf: string, hits: DxfHit[]): string {
  if (!hits.length) return originalDxf;

  const eol = originalDxf.includes('\r\n') ? '\r\n' : '\n';

  const pair = (code: number, val: string | number): string => {
    const codeStr = code.toString().padStart(3, ' ');
    return `${codeStr}${eol}${val}${eol}`;
  };

  let result = originalDxf;

  // Add PT-TENSILE-FAIL layer definition to TABLES section if present
  const layerDef = 
    pair(0, 'LAYER') +
    pair(2, 'PT-TENSILE-FAIL') +
    pair(70, 0) +
    pair(62, 1) + // Red Color
    pair(6, 'CONTINUOUS');

  if (result.includes(`SECTION${eol}  2${eol}TABLES`) || result.includes(`SECTION\n  2\nTABLES`)) {
    const layerTablePattern = pair(2, 'LAYER');
    if (result.includes(layerTablePattern)) {
      result = result.replace(layerTablePattern, `${layerTablePattern}${layerDef}`);
    }
  }

  // Construct PT-TENSILE-FAIL entities
  let newEntitiesStr = '';
  for (const hit of hits) {
    if (!hit.bbox) continue;
    const { minX, minY, maxX, maxY } = hit.bbox;

    // LWPOLYLINE rectangle around strip
    newEntitiesStr += 
      pair(0, 'LWPOLYLINE') +
      pair(8, 'PT-TENSILE-FAIL') +
      pair(62, 1) +
      pair(90, 4) +
      pair(70, 1) +
      pair(10, minX) +
      pair(20, minY) +
      pair(10, maxX) +
      pair(20, minY) +
      pair(10, maxX) +
      pair(20, maxY) +
      pair(10, minX) +
      pair(20, maxY);

    // TEXT callout for rebar details
    const textVal = `${hit.id}: ${hit.provide} (sig=${hit.sig.toFixed(2)})`;
    newEntitiesStr += 
      pair(0, 'TEXT') +
      pair(8, 'PT-TENSILE-FAIL') +
      pair(62, 1) +
      pair(10, minX) +
      pair(20, maxY + 100) +
      pair(40, 200) +
      pair(1, textVal);
  }

  // Insert before the last ENDSEC (or before EOF)
  const lastEndSec = result.lastIndexOf(`ENDSEC`);
  if (lastEndSec !== -1) {
    const beforeEndSec = result.lastIndexOf(pair(0, 'ENDSEC'));
    if (beforeEndSec !== -1) {
      result = result.substring(0, beforeEndSec) + newEntitiesStr + result.substring(beforeEndSec);
    } else {
      result = result.substring(0, lastEndSec) + newEntitiesStr + result.substring(lastEndSec);
    }
  } else {
    result += pair(0, 'SECTION') + pair(2, 'ENTITIES') + newEntitiesStr + pair(0, 'ENDSEC') + pair(0, 'EOF');
  }

  return result;
}

function normalize(s: string): string {
  return cleanMtext(s).toUpperCase().replace(/[^A-Z0-9-()]/g, '');
}
