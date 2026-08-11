export interface StressData {
  id: string;
  section: string;
  topStress: number;
  bottomStress: number;
  diameter: number;
  status: 'Pass' | 'Fail';
  ptSlabDepth: number;
  effDepth: number;
  hMinusX: number;
  x: number;
  ft: number;
  astReq: number;
  rebar: number;
  noOfBar: number;
  stripWidthRebar: number;
  spacingOfBar: number;
  adjusted?: boolean; // flag indicating auto‑adjust has been applied
}

export function parseInputData(
  text: string, 
  initialDiameter: number, 
  ptSlabDepth: number = 150,
  effDepth: number = 250
): StressData[] {
  const lines = text.trim().split('\n');
  const parsedData: StressData[] = [];

  for (const line of lines) {
    // Skip empty lines or headers
    if (!line.trim() || line.toLowerCase().includes('top stress')) continue;

    // Smart splitting: prioritize tabs, then commas, then fallback to whitespace
    let parts: string[];
    if (line.includes('\t')) {
      parts = line.split('\t').map(p => p.trim()).filter(p => p.length > 0);
    } else if (line.includes(',')) {
      parts = line.split(',').map(p => p.trim()).filter(p => p.length > 0);
    } else {
      parts = line.split(/\s+/).map(p => p.trim()).filter(p => p.length > 0);
    }
    
    if (parts.length < 4) {
      throw new Error(`Invalid data format on line: "${line}". Expected at least 4 columns (ID, Section, Top Stress, Bottom Stress).`);
    }

    const id = parts[0];
    const section = parts[1];
    const topStress = Math.abs(Number.parseFloat(parts[2]));
    const bottomStress = Math.abs(Number.parseFloat(parts[3]));

    if (Number.isNaN(topStress) || Number.isNaN(bottomStress)) {
      throw new TypeError(`Invalid stress values on line: "${line}". Expected numbers for Top and Bottom Stress.`);
    }

    parsedData.push(calculateRow(id, section, topStress, bottomStress, initialDiameter, ptSlabDepth, effDepth));
  }

  if (parsedData.length === 0) {
    throw new Error('No valid data found to parse.');
  }

  return parsedData;
}

export function checkStress(topStress: number, bottomStress: number): boolean {
  return Math.abs(topStress) <= 3.5 && Math.abs(bottomStress) <= 3.5;
}

export function calculateDiameterForSpacing(astReq: number, spacing: number, stripWidth = 1000): number {
  const absAstReq = Math.abs(astReq);
  const absSpacing = Math.max(1, Math.abs(spacing));
  if (absAstReq <= 0) return 12;

  const targetNoOfBar = stripWidth / absSpacing;
  if (targetNoOfBar <= 0) return 12;

  const requiredRebar = absAstReq / targetNoOfBar;
  const diameter = Math.sqrt((requiredRebar * 4) / Math.PI);
  // return Math.max(12, Number.isFinite(diameter) ? diameter : 12);
  
  const allowedDiameters = [12, 16, 20, 25, 32];
  for (const d of allowedDiameters) {
    if (d >= diameter) return d;
  }
  return 32;
}

export function calculateRow(
  id: string,
  section: string,
  topStress: number,
  bottomStress: number,
  diameter: number,
  ptSlabDepth: number,
  effDepth: number,
  adjusted: boolean = false
): StressData {
  const stripWidth = 1000;
  const top = Math.abs(topStress);
  const bottom = Math.abs(bottomStress);
  const barDiameter = Math.max(12, Math.abs(diameter));
  const hMinusX = top + bottom === 0 ? 0 : (top * effDepth) / (top + bottom);
  const x = Math.abs(effDepth - hMinusX);
  const ft = Math.abs((top * stripWidth * (effDepth - x) * 0.5) / 1000);
  const astReq = Math.abs((ft * 1000) / 287.5);
  const rebar = (barDiameter * barDiameter / 4) * Math.PI;
  const noOfBar = astReq === 0 ? 0 : astReq / rebar;
  const stripWidthRebar = noOfBar === 0 ? 0 : Math.abs(noOfBar / (stripWidth / 1000));
  const spacingOfBar = noOfBar === 0 ? 0 : Math.abs(stripWidth / noOfBar);

  return {
    id,
    section,
    topStress: top,
    bottomStress: bottom,
    diameter: barDiameter,
    status: checkStress(top, bottom) ? 'Pass' : 'Fail',
    ptSlabDepth,
    effDepth,
    hMinusX,
    x,
    ft,
    astReq,
    rebar,
    noOfBar,
    stripWidthRebar,
    spacingOfBar,
    adjusted,
  };
}

export function processStressData(data: StressData[]): StressData[] {
  return data.map(item => {
    // If this row has already been auto‑adjusted, skip further adjustments
    if (item.adjusted) {
      return item;
    }

    let currentDiameter = item.diameter;
    const pass = checkStress(item.topStress, item.bottomStress);

    if (!pass) {
      const stripWidth = 1000;
      const hMinusX = (item.topStress * item.effDepth) / (item.topStress + Math.abs(item.bottomStress));
      const x = item.effDepth - hMinusX;
      const ft = (item.topStress * stripWidth * (item.effDepth - x) * 0.5) / 1000;
      const astReq = (ft * 1000) / 287.5;
      const absAstReq = Math.abs(astReq);

      if (absAstReq > 0) {
        const spacing = item.spacingOfBar;
        if (spacing >= 75 && spacing <= 200) {
          currentDiameter = item.diameter;
        } else {
          const currentRebar = (currentDiameter * currentDiameter / 4) * Math.PI;
          const currentNoOfBar = absAstReq / currentRebar;
          const currentSpacing = currentNoOfBar === 0 ? stripWidth : stripWidth / currentNoOfBar;
          const targetSpacing = Math.max(100, Math.round(currentSpacing / 100) * 100);
          const requiredDiameter = Math.round(calculateDiameterForSpacing(absAstReq, targetSpacing, stripWidth));
          currentDiameter = Math.max(item.diameter, requiredDiameter);
        }
      } else {
        currentDiameter = 12; // default minimum
      }
    }

    // Recalculate row and mark it as adjusted if we performed auto‑adjust
    const newRow = calculateRow(
      item.id,
      item.section,
      item.topStress,
      item.bottomStress,
      currentDiameter,
      item.ptSlabDepth,
      item.effDepth,
      // Mark adjusted if diameter changed from original
      currentDiameter !== item.diameter
    );
    return newRow;
  });
}
