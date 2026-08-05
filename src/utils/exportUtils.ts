import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BaseEntity } from './dxfProcessor';

export function exportToExcel(originalData: BaseEntity[], modifiedData: BaseEntity[]) {
  const formatData = (data: BaseEntity[]) => data.map(edited => ({
    'AXIS': edited.axis || '-',
    'STRIP ID MARK': edited.id,
    'STRIP WIDTH': edited.stripWidth,
    'TOP STRESS': edited.topStress?.toFixed(4),
    'BOTTOM STRESS': edited.bottomStress?.toFixed(4),
    'PT SLAB DEPTH(D)': edited.ptSlabDepth,
    'EFF DEPTH (d)': edited.effDepth,
    'H-X': edited.hMinusX?.toFixed(2),
    'X': edited.x?.toFixed(2),
    'FT': edited.ft?.toFixed(2),
    'AST REQ': edited.astReq?.toFixed(2),
    'REBAR': edited.rebar,
    'NO OF BAR': edited.noOfBar,
    'SPACING OF BAR': edited.spacingOfBar,
    'STRES PASS/FAIL>3.5': edited.stressPassFail ? 'PASS' : 'FAIL',
    'STRIP WIDTH REBAR': edited.stripWidthRebar,
    'INPUT DIAMETER OF BAR': edited.inputDiameterOfBar,
    'SPACING': edited.spacing,
  }));

  if (originalData && originalData.length > 0) {
    const wbOriginal = XLSX.utils.book_new();
    const wsOriginal = XLSX.utils.json_to_sheet(formatData(originalData));
    XLSX.utils.book_append_sheet(wbOriginal, wsOriginal, 'Original Data');
    XLSX.writeFile(wbOriginal, 'DXF_Original_Data.xlsx');
  }

  if (modifiedData && modifiedData.length > 0) {
    const wbModified = XLSX.utils.book_new();
    const wsModified = XLSX.utils.json_to_sheet(formatData(modifiedData));
    XLSX.utils.book_append_sheet(wbModified, wsModified, 'Modified Data');
    XLSX.writeFile(wbModified, 'DXF_Modified_Data.xlsx');
  }
}

export function exportToPDF(data: BaseEntity[], filename: string = 'DXF_Data.pdf') {
  const doc = new jsPDF();
  doc.text('DXF Entity Data', 14, 15);
  
  const tableData = data.map(ent => [
    ent.axis || '-',
    ent.id,
    ent.type,
    ent.layer,
    ent.length !== undefined ? ent.length.toString() : '-',
    ent.area !== undefined ? ent.area.toString() : '-'
  ]);

  autoTable(doc, {
    head: [['Axis', 'ID', 'Type', 'Layer', 'Length', 'Area']],
    body: tableData,
    startY: 20,
  });

  doc.save(filename);
}

export function exportUpdatedDxf(originalDxf: any, data: BaseEntity[], axisLabel: string = 'Axis') {
  const filename = `updated_${axisLabel}.dxf`;
  let dxfString = "  0\nSECTION\n  2\nENTITIES\n";

  if (originalDxf && originalDxf.entities) {
    originalDxf.entities.forEach((ent: any) => {
      // Find modified entity data from our table
      const edited = data.find(d => d.id === ent.handle) || data.find(d => d.id === ent.id);

      if (ent.type === 'LINE') {
        dxfString += "  0\nLINE\n";
        if (ent.handle) dxfString += `  5\n${ent.handle}\n`;
        dxfString += `  8\n${ent.layer}\n`;
        if (ent.colorNumber !== undefined) dxfString += ` 62\n${ent.colorNumber}\n`;
        
        const x1 = ent.vertices[0]?.x || 0;
        const y1 = ent.vertices[0]?.y || 0;
        const z1 = ent.vertices[0]?.z || 0;
        const x2 = ent.vertices[1]?.x || 0;
        const y2 = ent.vertices[1]?.y || 0;
        const z2 = ent.vertices[1]?.z || 0;

        dxfString += ` 10\n${x1}\n 20\n${y1}\n 30\n${z1}\n`;
        dxfString += ` 11\n${x2}\n 21\n${y2}\n 31\n${z2}\n`;
      } else if (ent.type === 'CIRCLE') {
        dxfString += "  0\nCIRCLE\n";
        if (ent.handle) dxfString += `  5\n${ent.handle}\n`;
        dxfString += `  8\n${ent.layer}\n`;
        if (ent.colorNumber !== undefined) dxfString += ` 62\n${ent.colorNumber}\n`;
        
        const cx = ent.center?.x || 0;
        const cy = ent.center?.y || 0;
        const cz = ent.center?.z || 0;
        const r = ent.radius || 1;

        dxfString += ` 10\n${cx}\n 20\n${cy}\n 30\n${cz}\n`;
        dxfString += ` 40\n${r}\n`;
      } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
        dxfString += `  0\n${ent.type}\n`;
        if (ent.handle) dxfString += `  5\n${ent.handle}\n`;
        dxfString += `  8\n${ent.layer}\n`;
        if (ent.colorNumber !== undefined) dxfString += ` 62\n${ent.colorNumber}\n`;
        
        const sx = ent.startPoint?.x || 0;
        const sy = ent.startPoint?.y || 0;
        const sz = ent.startPoint?.z || 0;

        dxfString += ` 10\n${sx}\n 20\n${sy}\n 30\n${sz}\n`;
        dxfString += ` 40\n${ent.textHeight || 1}\n`;
        dxfString += `  1\n${ent.text || ''}\n`;
        if (ent.rotation) dxfString += ` 50\n${ent.rotation}\n`;
      } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
        if (ent.vertices && ent.vertices.length > 0) {
          dxfString += "  0\nLWPOLYLINE\n";
          if (ent.handle) dxfString += `  5\n${ent.handle}\n`;
          dxfString += `  8\n${ent.layer}\n`;
          if (ent.colorNumber !== undefined) dxfString += ` 62\n${ent.colorNumber}\n`;
          
          dxfString += ` 90\n${ent.vertices.length}\n`;
          dxfString += ` 70\n${ent.shape || ent.closed ? 1 : 0}\n`;
          
          ent.vertices.forEach((v: any) => {
            dxfString += ` 10\n${v.x}\n 20\n${v.y}\n`;
          });
        }
      }

      // Append XDATA (1001 / 1000) for structural metadata if it exists
      if (edited) {
        const metadataEntries = [
          ['STRIP ID MARK', edited.id],
          ['STRIP WIDTH', edited.stripWidth],
          ['TOP STRESS', edited.topStress?.toFixed(4)],
          ['BOTTOM STRESS', edited.bottomStress?.toFixed(4)],
          ['PT SLAB DEPTH(D)', edited.ptSlabDepth],
          ['EFF DEPTH (d)', edited.effDepth],
          ['H-X', edited.hMinusX?.toFixed(2)],
          ['X', edited.x?.toFixed(2)],
          ['FT', edited.ft?.toFixed(2)],
          ['AST REQ', edited.astReq?.toFixed(2)],
          ['REBAR', edited.rebar],
          ['NO OF BAR', edited.noOfBar],
          ['SPACING OF BAR', edited.spacingOfBar],
          ['STRES PASS/FAIL>3.5', edited.stressPassFail ? 'PASS' : 'FAIL'],
          ['STRIP WIDTH REBAR', edited.stripWidthRebar],
          ['INPUT DIAMETER OF BAR', edited.inputDiameterOfBar],
          ['SPACING', edited.spacing],
        ].filter(([, value]) => value !== undefined && value !== null && value !== '');

        if (metadataEntries.length > 0) {
          dxfString += " 1001\nDFX_EDITOR\n";
          metadataEntries.forEach(([key, value]) => {
            dxfString += ` 1000\n${key}=${value}\n`;
          });
        }
      }
    });
  }

  dxfString += "  0\nENDSEC\n  0\nEOF\n";

  const blob = new Blob([dxfString], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
