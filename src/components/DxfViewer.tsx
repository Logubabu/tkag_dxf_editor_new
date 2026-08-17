import React, { useState, useEffect } from 'react';
import { Upload, Download, FileCode, AlertCircle, Layers, CheckCircle2, Sun, Moon, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StressData } from '../utils/stressCalculations';
import { processDxfFile, type ProcessedDxf, type DxfHit } from '../utils/dxfMarkup';

interface DxfViewerProps {
  stressRows: StressData[];
  barDia?: number;
  stressLimit?: number;
}

export const DxfViewer: React.FC<DxfViewerProps> = ({
  stressRows,
  barDia = 12,
  stressLimit = 3.5,
}) => {
  const [rawTextA, setRawTextA] = useState<{ text: string; fileName: string } | null>(null);
  const [rawTextB, setRawTextB] = useState<{ text: string; fileName: string } | null>(null);

  const [dxfA, setDxfA] = useState<ProcessedDxf | null>(null);
  const [dxfB, setDxfB] = useState<ProcessedDxf | null>(null);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Automatically re-process DXFs whenever calculation stress rows or parameters change
  useEffect(() => {
    if (rawTextA) {
      try {
        const processed = processDxfFile(rawTextA.text, rawTextA.fileName, stressRows, barDia, stressLimit);
        setDxfA(processed);
        setErrorA(null);
      } catch (err: any) {
        setErrorA(err.message || 'Error processing Drawing A');
      }
    }
  }, [rawTextA, stressRows, barDia, stressLimit]);

  useEffect(() => {
    if (rawTextB) {
      try {
        const processed = processDxfFile(rawTextB.text, rawTextB.fileName, stressRows, barDia, stressLimit);
        setDxfB(processed);
        setErrorB(null);
      } catch (err: any) {
        setErrorB(err.message || 'Error processing Drawing B');
      }
    }
  }, [rawTextB, stressRows, barDia, stressLimit]);

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    slot: 'a' | 'b'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const setError = slot === 'a' ? setErrorA : setErrorB;
    const setRaw = slot === 'a' ? setRawTextA : setRawTextB;

    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        setRaw({ text, fileName: file.name });
      } catch (err: any) {
        setError(err.message || 'Error reading file.');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
    };

    reader.readAsText(file);
  };

  const handleDownload = (processed: ProcessedDxf) => {
    if (!processed || !processed.markedDxfString) return;
    const blob = new Blob([processed.markedDxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marked_${processed.fileName}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadBoth = () => {
    if (dxfA) handleDownload(dxfA);
    if (dxfB) handleDownload(dxfB);
  };

  // Convert SVG element to PNG Data URL reliably using Canvas
  const convertSvgToPng = (svgEl: SVGSVGElement, width = 1400, height = 750, bgColor = '#fbfaf7'): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
        clonedSvg.setAttribute('width', String(width));
        clonedSvg.setAttribute('height', String(height));

        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', '100%');
        bgRect.setAttribute('height', '100%');
        bgRect.setAttribute('fill', bgColor);
        clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

        const xml = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
          }
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve('');
        };
        img.src = url;
      } catch {
        resolve('');
      }
    });
  };

  const exportDxfPdf = async () => {
    if (!dxfA && !dxfB) return alert('Please upload at least one DXF drawing to export PDF.');

    setIsExportingPdf(true);

    try {
      const doc = new jsPDF('landscape');
      let pageAdded = false;

      const exportSlot = async (dxf: ProcessedDxf, containerId: string, slotTitle: string) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const svgEl = container.querySelector('svg');
        if (!svgEl) return;

        if (pageAdded) doc.addPage();
        pageAdded = true;

        doc.setFontSize(14);
        doc.setTextColor(31, 92, 74);
        doc.text(`DXF Design Strip Plan Markup — ${slotTitle} (${dxf.fileName})`, 14, 15);

        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Flagged Strips exceeding stress limit (${stressLimit} MPa): ${dxf.hits.length}`, 14, 22);

        const imgData = await convertSvgToPng(svgEl, 1400, 750, isDarkMode ? '#090d16' : '#fbfaf7');
        if (imgData) {
          doc.addImage(imgData, 'PNG', 14, 26, 268, 120);
        }

        if (dxf.hits.length > 0) {
          autoTable(doc, {
            startY: 152,
            head: [['Strip ID', 'DXF Label', 'Governing Stress (N/mm²)', 'Ast Req (mm²)', 'Reinforcement Callout']],
            body: dxf.hits.map((h) => [
              h.id,
              h.label,
              h.sig.toFixed(3),
              h.ast.toFixed(2),
              h.provide,
            ]),
            headStyles: { fillColor: [163, 46, 34], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 8 },
          });
        }
      };

      if (dxfA) await exportSlot(dxfA, 'dxf-canvas-a', 'Drawing A (Latitude)');
      if (dxfB) await exportSlot(dxfB, 'dxf-canvas-b', 'Drawing B (Longitude)');

      doc.save('marked_up_drawings_plan.pdf');
    } catch (err: any) {
      alert(`Error generating PDF: ${err.message}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const renderSvgContent = (dxf: ProcessedDxf, containerId: string) => {
    const strokeLine = isDarkMode ? '#64748b' : '#334155';
    const strokePoly = isDarkMode ? '#475569' : '#1e293b';
    const fillText = isDarkMode ? '#94a3b8' : '#475569';
    const failBoxFill = isDarkMode ? '#ef4444' : '#a32e22';
    const failBoxOpacity = isDarkMode ? 0.25 : 0.15;
    const failBoxStroke = isDarkMode ? '#ef4444' : '#a32e22';
    const failTextFill = isDarkMode ? '#f87171' : '#a32e22';

    return (
      <div id={containerId} className="w-full">
        <svg
          viewBox={dxf.viewBox}
          className={`w-full h-[480px] rounded-lg overflow-hidden border transition-colors ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#fbfaf7] border-slate-300'
          }`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Render base DXF Lines */}
          {dxf.entities.map((ent, idx) => {
            if (ent.type === 'LINE' && ent.startPoint && ent.endPoint) {
              return (
                <line
                  key={`line_${idx}`}
                  x1={ent.startPoint.x}
                  y1={ent.startPoint.y}
                  x2={ent.endPoint.x}
                  y2={ent.endPoint.y}
                  stroke={strokeLine}
                  strokeWidth="2"
                />
              );
            }
            if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices && ent.vertices.length > 1) {
              const pointsStr = ent.vertices.map((v) => `${v.x},${v.y}`).join(' ');
              return (
                <polyline
                  key={`poly_${idx}`}
                  points={pointsStr}
                  fill="none"
                  stroke={strokePoly}
                  strokeWidth="2"
                />
              );
            }
            if ((ent.type === 'TEXT' || ent.type === 'MTEXT') && ent.position && ent.text) {
              return (
                <text
                  key={`text_${idx}`}
                  x={ent.position.x}
                  y={ent.position.y}
                  fill={fillText}
                  fontSize={ent.textHeight || 150}
                  fontFamily="monospace"
                >
                  {ent.text.replace(/\\P/g, ' ')}
                </text>
              );
            }
            return null;
          })}

          {/* Render Highlighted Red Bounding Boxes for Failed Strips (PT-TENSILE-FAIL) */}
          {dxf.hits.map((hit, idx) => {
            if (!hit.bbox) return null;
            const w = hit.bbox.maxX - hit.bbox.minX;
            const h = hit.bbox.maxY - hit.bbox.minY;
            return (
              <g key={`hit_${hit.id}_${idx}`}>
                <rect
                  x={hit.bbox.minX}
                  y={hit.bbox.minY}
                  width={w}
                  height={h}
                  fill={failBoxFill}
                  fillOpacity={failBoxOpacity}
                  stroke={failBoxStroke}
                  strokeWidth="4"
                />
                <text
                  x={hit.bbox.minX}
                  y={hit.bbox.maxY + 120}
                  fill={failTextFill}
                  fontSize={160}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {hit.id}: {hit.provide}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderHitTable = (hits: DxfHit[], drawingName: string) => {
    if (hits.length === 0) {
      return (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg flex items-center gap-2">
          <CheckCircle2 size={16} />
          No failed design strips flagged in {drawingName}. All sections satisfy stress limits.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-3 py-2">Strip ID</th>
              <th className="px-3 py-2">DXF Label</th>
              <th className="px-3 py-2 text-right">Governing &sigma; (N/mm²)</th>
              <th className="px-3 py-2 text-right">A<sub>st</sub> req (mm²)</th>
              <th className="px-3 py-2">Reinforcement Written to DXF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono">
            {hits.map((hit) => (
              <tr key={`${hit.id}_${hit.section}`} className="hover:bg-red-50/50">
                <td className="px-3 py-2 font-bold text-slate-800">{hit.id}</td>
                <td className="px-3 py-2 text-slate-600">{hit.label}</td>
                <td className="px-3 py-2 text-right font-bold text-red-600">{hit.sig.toFixed(3)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{hit.ast.toFixed(2)}</td>
                <td className="px-3 py-2 font-bold text-amber-600">{hit.provide}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6 my-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Layers className="text-amber-600 w-5 h-5" />
            <span>Design Strip Plan — DXF Viewer & Markup Export</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload Latitude & Longitude DXF drawings. Failed sections are marked on layer{' '}
            <strong className="font-mono text-red-600">PT-TENSILE-FAIL</strong> and exported as CAD-ready DXF or PDF files.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Background Canvas Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shadow-sm"
            title="Toggle DXF Viewer Background Color"
          >
            {isDarkMode ? (
              <>
                <Sun size={14} className="text-amber-500" />
                <span>Background: Light (#fbfaf7)</span>
              </>
            ) : (
              <>
                <Moon size={14} className="text-slate-600" />
                <span>Background: Dark CAD (#090d16)</span>
              </>
            )}
          </button>

          {(dxfA || dxfB) && (
            <button
              onClick={exportDxfPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <FileText size={15} />
              {isExportingPdf ? 'Exporting PDF...' : 'Export Marked-Up Drawings as PDF'}
            </button>
          )}

          {dxfA && dxfB && (
            <button
              onClick={downloadBoth}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
            >
              <Download size={16} />
              Export Both Marked-Up DXFs
            </button>
          )}
        </div>
      </div>

      {/* Upload Dual Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Drawing A: Latitude */}
        <div className="border border-slate-200 bg-slate-50/50 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-blue-600" />
              Drawing A — Latitude Strip Plan
            </h3>
            {dxfA && (
              <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                {dxfA.hits.length} strips flagged
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-sm">
              <Upload size={14} />
              Open .DXF File
              <input
                type="file"
                accept=".dxf"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'a')}
              />
            </label>

            {dxfA && (
              <button
                onClick={() => handleDownload(dxfA)}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors shadow-sm ml-auto"
              >
                <Download size={14} />
                Export Fixed DXF
              </button>
            )}
          </div>

          {errorA && (
            <div className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={14} /> {errorA}
            </div>
          )}

          {dxfA && (
            <div className="space-y-3 pt-2">
              {renderSvgContent(dxfA, 'dxf-canvas-a')}
              {renderHitTable(dxfA.hits, 'Drawing A')}
            </div>
          )}
        </div>

        {/* Drawing B: Longitude */}
        <div className="border border-slate-200 bg-slate-50/50 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-600" />
              Drawing B — Longitude Strip Plan
            </h3>
            {dxfB && (
              <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                {dxfB.hits.length} strips flagged
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-sm">
              <Upload size={14} />
              Open .DXF File
              <input
                type="file"
                accept=".dxf"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'b')}
              />
            </label>

            {dxfB && (
              <button
                onClick={() => handleDownload(dxfB)}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors shadow-sm ml-auto"
              >
                <Download size={14} />
                Export Fixed DXF
              </button>
            )}
          </div>

          {errorB && (
            <div className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={14} /> {errorB}
            </div>
          )}

          {dxfB && (
            <div className="space-y-3 pt-2">
              {renderSvgContent(dxfB, 'dxf-canvas-b')}
              {renderHitTable(dxfB.hits, 'Drawing B')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
