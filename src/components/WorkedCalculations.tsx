import React, { useState } from 'react';
import type { StressData } from '../utils/stressCalculations';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from 'lucide-react';

interface WorkedCalculationsProps {
  data: StressData[];
  stripWidth?: number;
  steelStress?: number;
  stressLimit?: number;
}

export const WorkedCalculations: React.FC<WorkedCalculationsProps> = ({
  data,
  stripWidth = 1000,
  steelStress = 287.5,
  stressLimit = 3.5,
}) => {
  const [expandAll, setExpandAll] = useState(true);

  if (!data || data.length === 0) return null;

  // Sort rows to find governing sections (highest top or bottom stress)
  const sortedData = [...data].sort(
    (a, b) => Math.max(b.topStress, b.bottomStress) - Math.max(a.topStress, a.bottomStress)
  );

  // Take top 5 worst sections
  const governingRows = sortedData.slice(0, 5);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 my-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Worked Calculation — Governing Sections</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Step-by-step mathematical breakdown for sections with peak tensile stresses.
          </p>
        </div>
        <button
          onClick={() => setExpandAll(!expandAll)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 transition-colors"
        >
          {expandAll ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className="space-y-4">
        {governingRows.map((row) => {
          const govStress = Math.max(row.topStress, row.bottomStress);
          const isFail = govStress > stressLimit || row.status === 'Fail';
          const range = Math.floor(row.spacingOfBar / 25) * 25;
          const abar = ((row.diameter * row.diameter) / 4) * Math.PI;

          return (
            <div
              key={`${row.id}_${row.section}`}
              className={`border rounded-lg overflow-hidden transition-all ${
                isFail ? 'border-red-200 bg-red-50/20' : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div
                className={`p-4 flex items-center justify-between cursor-pointer ${
                  isFail ? 'bg-red-50 border-b border-red-100' : 'bg-slate-100 border-b border-slate-200'
                }`}
                onClick={() => setExpandAll(!expandAll)}
              >
                <div className="flex items-center gap-3">
                  {isFail ? (
                    <AlertTriangle className="text-red-600 w-5 h-5" />
                  ) : (
                    <CheckCircle className="text-emerald-600 w-5 h-5" />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      ID: <span className="font-mono">{row.id}</span> &nbsp;|&nbsp; Section:{' '}
                      <span className="font-mono">{row.section}</span>
                    </h3>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Top: {row.topStress.toFixed(3)} N/mm² &middot; Bottom: {row.bottomStress.toFixed(3)} N/mm² &middot; Eff Depth d: {row.effDepth} mm
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                      isFail ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {isFail ? 'FAIL (> 3.5 MPa)' : 'PASS'}
                  </span>
                  {expandAll ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {expandAll && (
                <div className="p-4 space-y-4 text-xs font-mono text-slate-700 bg-white">
                  {/* Step 1: Neutral Axis Calculation */}
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                    <div className="font-sans font-bold text-slate-800 text-xs text-slate-500 uppercase tracking-wider mb-1">
                      1. Neutral Axis Calculation
                    </div>
                    <div>
                      (h - X) = &sigma;<sub>top</sub> &middot; d / (&sigma;<sub>top</sub> + &sigma;<sub>bot</sub>) = {row.topStress.toFixed(3)} &middot; {row.effDepth} / ({row.topStress.toFixed(3)} + {row.bottomStress.toFixed(3)}) = <strong>{row.hMinusX.toFixed(2)} mm</strong>
                    </div>
                    <div>
                      X = d - (h - X) = {row.effDepth} - {row.hMinusX.toFixed(2)} = <strong>{row.x.toFixed(2)} mm</strong>
                    </div>
                  </div>

                  {/* Step 2: Tensile Force & Required Steel */}
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                    <div className="font-sans font-bold text-slate-800 text-xs text-slate-500 uppercase tracking-wider mb-1">
                      2. Tensile Force & Required Steel Area (A<sub>st,req</sub>)
                    </div>
                    <div>
                      F<sub>t</sub> = &sigma;<sub>top</sub> &middot; b &middot; (d - X) &middot; 0.5 / 10³ = {row.topStress.toFixed(3)} &middot; {stripWidth} &middot; ({row.effDepth} - {row.x.toFixed(2)}) &middot; 0.5 / 10³ = <strong>{row.ft.toFixed(2)} kN</strong>
                    </div>
                    <div>
                      A<sub>st,req</sub> = F<sub>t</sub> &middot; 10³ / f<sub>s</sub> = {row.ft.toFixed(2)} &middot; 10³ / {steelStress} = <strong className="text-blue-700">{row.astReq.toFixed(2)} mm²</strong>
                    </div>
                  </div>

                  {/* Step 3: Bar Selection & Spacing */}
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                    <div className="font-sans font-bold text-slate-800 text-xs text-slate-500 uppercase tracking-wider mb-1">
                      3. Bar Arrangement & Provided Reinforcement
                    </div>
                    <div>
                      A<sub>bar</sub> = (&pi; &middot; &Oslash;² / 4) = (&pi; &middot; {row.diameter}² / 4) = <strong>{abar.toFixed(2)} mm²</strong>
                    </div>
                    <div>
                      n = A<sub>st,req</sub> / A<sub>bar</sub> = {row.astReq.toFixed(2)} / {abar.toFixed(2)} = <strong>{row.noOfBar.toFixed(2)} bars</strong>
                    </div>
                    <div>
                      Spacing = b / n = {stripWidth} / {row.noOfBar.toFixed(2)} = <strong>{row.spacingOfBar.toFixed(1)} mm</strong>
                    </div>
                    <div className="pt-1 text-sm font-sans font-bold text-indigo-700">
                      Provided Callout: T{row.diameter} @ {range} mm
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
