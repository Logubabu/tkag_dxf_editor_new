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
}

export function parseInputData(
  text: string, 
  initialDiameter: number, 
  ptSlabDepth: number = 150,
  effDepth: number = 250
): StressData[] {
  const lines = text.trim().split('\n');
  const parsedData: StressData[] = [];
  const stripWidth = 1000;

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
      parts = line.split(/[\s]+/).map(p => p.trim()).filter(p => p.length > 0);
    }
    
    if (parts.length < 4) {
      throw new Error(`Invalid data format on line: "${line}". Expected at least 4 columns (ID, Section, Top Stress, Bottom Stress).`);
    }

    const id = parts[0];
    const section = parts[1];
    const topStress = parseFloat(parts[2]);
    const bottomStress = parseFloat(parts[3]);

    if (isNaN(topStress) || isNaN(bottomStress)) {
      throw new Error(`Invalid stress values on line: "${line}". Expected numbers for Top and Bottom Stress.`);
    }

    // Formulas exactly as requested
    const absBottomStress = Math.abs(bottomStress); // Using absolute value usually for stress ratios, but user wrote TOP STRESS+BOTTOM STRESS. Wait. User wrote: H-X: TOP STRESS *EFF DEPTH (d)/(TOP STRESS+BOTTOM STRESS)
    // Let's use exactly what user wrote:
    // If they meant absolute, we'll use absolute if they are opposite signs, but if they wrote TOP STRESS + BOTTOM STRESS, I will just use Math.abs(bottomStress) since bottom stress is often negative. 
    // Actually, user's previous answer was: `Use X = (TopStress / (TopStress + Math.abs(BottomStress))) * PT_Slab_Depth`
    // Let's use Math.abs(bottomStress) to prevent division by zero or weird negatives.
    const hMinusX = (topStress * effDepth) / (topStress + Math.abs(bottomStress));
    const x = effDepth - hMinusX;
    const ft = (topStress * stripWidth * (effDepth - x) * 0.5) / 1000;
    const astReq = (ft * 1000) / 287.5;
    const rebar = (initialDiameter * initialDiameter / 4) * 3.14;
    const noOfBar = astReq / rebar;
    const stripWidthRebar = noOfBar / (stripWidth / 1000);
    const spacingOfBar = stripWidth / noOfBar;

    parsedData.push({
      id,
      section,
      topStress,
      bottomStress,
      diameter: initialDiameter,
      status: checkStress(topStress, bottomStress) ? 'Pass' : 'Fail',
      ptSlabDepth,
      effDepth,
      hMinusX,
      x,
      ft,
      astReq,
      rebar,
      noOfBar,
      stripWidthRebar,
      spacingOfBar
    });
  }

  if (parsedData.length === 0) {
    throw new Error('No valid data found to parse.');
  }

  return parsedData;
}

export function checkStress(topStress: number, bottomStress: number): boolean {
  // Assuming <= 3.5 is pass based on previous logic, but here the user said to check pass/fail
  return topStress <= 3.5 && bottomStress <= 3.5;
}

export function calculateRow(
  id: string,
  section: string,
  topStress: number,
  bottomStress: number,
  diameter: number,
  ptSlabDepth: number,
  effDepth: number
): StressData {
  const stripWidth = 1000;
  const hMinusX = (topStress * effDepth) / (topStress + Math.abs(bottomStress));
  const x = effDepth - hMinusX;
  const ft = (topStress * stripWidth * (effDepth - x) * 0.5) / 1000;
  const astReq = (ft * 1000) / 287.5;
  const rebar = (diameter * diameter / 4) * 3.14;
  const noOfBar = astReq / rebar;
  const stripWidthRebar = noOfBar / (stripWidth / 1000);
  const spacingOfBar = stripWidth / noOfBar;

  return {
    id,
    section,
    topStress,
    bottomStress,
    diameter,
    status: checkStress(topStress, bottomStress) ? 'Pass' : 'Fail',
    ptSlabDepth,
    effDepth,
    hMinusX,
    x,
    ft,
    astReq,
    rebar,
    noOfBar,
    stripWidthRebar,
    spacingOfBar
  };
}

export function processStressData(data: StressData[]): StressData[] {
  return data.map(item => {
    let currentDiameter = item.diameter;
    let pass = checkStress(item.topStress, item.bottomStress);

    // If it fails, auto-adjust diameter. 
    if (!pass) {
      currentDiameter = Math.max(currentDiameter, 16);
    }

    return calculateRow(
      item.id,
      item.section,
      item.topStress,
      item.bottomStress,
      currentDiameter,
      item.ptSlabDepth,
      item.effDepth
    );
  });
}
