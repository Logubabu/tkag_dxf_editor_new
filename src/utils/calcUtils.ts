import type { BaseEntity } from './dxfProcessor';

export interface GlobalMaterialProps {
  fck: number;
  fy: number;
}

export function calculateFields(entity: BaseEntity, editedField?: string, globalProps: GlobalMaterialProps = { fck: 30, fy: 500 }): BaseEntity {
  const stripWidth = Math.max(entity.stripWidth || 1000, 1);
  const ptSlabDepth = Math.max(entity.ptSlabDepth || 150, 1);
  const effectiveDepth = Math.max(entity.effDepth || (ptSlabDepth - 25), 1);
  const barDiameter = Math.max(entity.inputDiameterOfBar || 12, 1);
  const stripWidthRebar = Math.max(entity.stripWidthRebar || stripWidth, 1);
  const appliedMoment = entity.appliedMoment || 0; // kNm
  
  // Calculate initial top and bottom stress based on Z properties if available
  // M is in kNm, Z is in mm^3. Stress = M * 10^6 / Z (MPa)
  let topStress = entity.topStress || 0;
  let bottomStress = entity.bottomStress || 0;

  if (entity.zTop && entity.zBottom) {
    topStress = (appliedMoment * 1e6) / entity.zTop;
    bottomStress = (appliedMoment * 1e6) / entity.zBottom;
  } else {
    // Fallback if not a closed polygon, use rectangular section Z = bd^2/6
    const zRect = (stripWidth * ptSlabDepth * ptSlabDepth) / 6;
    topStress = (appliedMoment * 1e6) / zRect;
    bottomStress = topStress;
  }

  // Calculate required Ast based on Bending Moment
  // Simplified formula: Ast = M / (0.87 * fy * 0.85 * d)
  let computedAstReq = (appliedMoment * 1e6) / (0.87 * globalProps.fy * 0.85 * effectiveDepth);
  
  let astReq = entity.astReq || computedAstReq;
  
  // If astReq is manually edited, preserve it
  if (editedField === 'astReq' && entity.astReq !== undefined) {
    astReq = entity.astReq;
  } else if (['appliedMoment', 'ptSlabDepth', 'effDepth'].includes(editedField || '')) {
    astReq = computedAstReq;
  }

  const areaOfBar = (Math.PI * Math.pow(barDiameter, 2)) / 4;
  let noOfBars = entity.noOfBar || 1;
  let spacing = entity.spacing || 200;

  // Pass fail check
  const stressPassFail = topStress <= 3.5 && bottomStress <= 3.5;

  // Handle user edits for spacing, diameter, etc.
  if (editedField === 'spacing' && entity.spacing) {
    spacing = entity.spacing;
    noOfBars = Math.max(Math.ceil(stripWidthRebar / spacing), 1);
  } else if (editedField === 'inputDiameterOfBar' && entity.inputDiameterOfBar) {
    noOfBars = Math.max(Math.ceil(stripWidthRebar / spacing), 1);
  } else if (editedField === 'noOfBar' && entity.noOfBar) {
    noOfBars = entity.noOfBar;
    spacing = Math.max(Math.floor(stripWidthRebar / noOfBars), 1);
  } else {
    // Determine required bars from Ast
    noOfBars = Math.max(Math.ceil(astReq / areaOfBar), 1);
    spacing = Math.max(Math.floor(stripWidthRebar / noOfBars), 1);
    
    // Auto adjust if stress check fails
    if (!stressPassFail) {
      spacing = Math.min(spacing, 100);
      noOfBars = Math.max(Math.ceil(stripWidthRebar / spacing), 1);
    }
  }

  // Recalculate other columns
  let x = entity.centroidY !== undefined ? entity.centroidY : (ptSlabDepth / 2);
  let hMinusX = ptSlabDepth - x;
  let ft = 0.5 * topStress * hMinusX * stripWidth;
  
  const rebar = `${noOfBars}T${barDiameter}`;

  return {
    ...entity,
    stripWidth,
    ptSlabDepth,
    effDepth: effectiveDepth,
    inputDiameterOfBar: barDiameter,
    stripWidthRebar,
    noOfBar: noOfBars,
    spacingOfBar: spacing,
    spacing,
    astReq,
    topStress,
    bottomStress,
    stressPassFail,
    x,
    hMinusX,
    ft,
    rebar,
    appliedMoment,
  };
}
