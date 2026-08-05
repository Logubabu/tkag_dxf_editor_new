export interface StressData {
  id: string;
  section: string;
  topStress: number;
  bottomStress: number;
  diameter: number;
  space: number;
  status: 'Pass' | 'Fail';
}

export function parseInputData(text: string, initialDiameter: number, initialSpace: number): StressData[] {
  const lines = text.trim().split('\n');
  const parsedData: StressData[] = [];

  for (const line of lines) {
    // Skip empty lines or headers
    if (!line.trim() || line.toLowerCase().includes('top stress')) continue;

    // Attempt to split by tab or comma
    const parts = line.split(/[\t,]+/).map(p => p.trim());
    if (parts.length >= 4) {
      const id = parts[0];
      const section = parts[1];
      const topStress = parseFloat(parts[2]);
      const bottomStress = parseFloat(parts[3]);

      if (!isNaN(topStress) && !isNaN(bottomStress)) {
        parsedData.push({
          id,
          section,
          topStress,
          bottomStress,
          diameter: initialDiameter,
          space: initialSpace,
          status: checkStress(topStress, bottomStress) ? 'Pass' : 'Fail',
        });
      }
    }
  }

  return parsedData;
}

export function checkStress(topStress: number, bottomStress: number): boolean {
  // Assuming <= 3.5 is pass based on previous logic, but here the user said to check pass/fail
  return topStress <= 3.5 && bottomStress <= 3.5;
}

export function processStressData(data: StressData[]): StressData[] {
  return data.map(item => {
    let currentSpace = item.space;
    let currentDiameter = item.diameter;
    let pass = checkStress(item.topStress, item.bottomStress);

    // If it fails, auto-adjust space and diameter. 
    if (!pass) {
      currentSpace = Math.min(currentSpace, 100);
      currentDiameter = Math.max(currentDiameter, 16); // Example logic
      pass = checkStress(item.topStress, item.bottomStress); 
    }

    return {
      ...item,
      space: currentSpace,
      diameter: currentDiameter,
      status: pass ? 'Pass' : 'Fail',
    };
  });
}
