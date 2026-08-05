import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ValueSetterParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface GridProps {
  originalData: any[];
  modifiedData: any[];
  onDataChange: (newData: any[]) => void;
}

const number = (digits = 2) => (params: any) =>
  typeof params.value === 'number' ? params.value.toFixed(digits) : params.value ?? '-';

const statusCell = (params: any) => {
  const pass = params.value === 'PASS';
  return <span className={pass ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>{params.value ?? '-'}</span>;
};

const baseColumns: ColDef[] = [
  { field: 'axis', headerName: 'Axis', pinned: 'left', width: 70 },
  { field: 'stripIdMark', headerName: 'Strip ID / Mark', pinned: 'left', minWidth: 150 },
  { field: 'type', headerName: 'Type', width: 100 },
  { field: 'layer', headerName: 'Layer', minWidth: 110 },
  { field: 'beamWidth', headerName: 'Beam Width (mm)', valueFormatter: number(), width: 130 },
  { field: 'beamDepth', headerName: 'Beam Depth (mm)', valueFormatter: number(), width: 135 },
  { field: 'ptSlabDepth', headerName: 'PT Slab Depth (mm)', valueFormatter: number(), width: 145 },
  { field: 'effDepth', headerName: 'Effective Depth (mm)', valueFormatter: number(), width: 150 },
  { field: 'appliedMoment', headerName: 'Moment (kNm)', valueFormatter: number(), width: 125 },
  { field: 'topStress', headerName: 'Top Stress (MPa)', valueFormatter: number(4), width: 135 },
  { field: 'bottomStress', headerName: 'Bottom Stress (MPa)', valueFormatter: number(4), width: 145 },
  { field: 'stressStatus', headerName: 'Stress Check', cellRenderer: statusCell, width: 120 },
  { field: 'astReq', headerName: 'Ast Required (mm²)', valueFormatter: number(), width: 145 },
  { field: 'barDiameter', headerName: 'Input Bar Dia (mm)', valueFormatter: number(), width: 145 },
  { field: 'spacing', headerName: 'Spacing (mm)', valueFormatter: number(), width: 120 },
  { field: 'noOfBar', headerName: 'No. of Bars', valueFormatter: number(0), width: 115 },
  { field: 'astProvided', headerName: 'Ast Provided (mm²)', valueFormatter: number(), width: 150 },
  { field: 'difference', headerName: 'Ast Difference', valueFormatter: number(), width: 130 },
  { field: 'utilization', headerName: 'Utilization (%)', valueFormatter: number(), width: 125 },
  { field: 'rebar', headerName: 'Rebar', width: 105 },
  { field: 'reinforcementStatus', headerName: 'Rebar Check', cellRenderer: statusCell, width: 120 },
];

export const ComparisonGrid = ({ originalData, modifiedData, onDataChange }: GridProps) => {
  const originalColumns = useMemo(() => baseColumns, []);
  const modifiedColumns = useMemo<ColDef[]>(() => baseColumns.map(column => {
    if (column.field !== 'barDiameter' && column.field !== 'spacing') return column;
    return {
      ...column,
      editable: true,
      cellClass: 'editable-cell',
      valueSetter: (params: ValueSetterParams) => {
        const value = Number(params.newValue);
        if (!Number.isFinite(value) || value <= 0) return false;
        onDataChange(modifiedData.map(row =>
          row.id === params.data.id && row.axis === params.data.axis ? { ...row, [column.field!]: value } : row,
        ));
        return false;
      },
    };
  }), [modifiedData, onDataChange]);

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, filter: true, resizable: true }), []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-600 bg-slate-700/60 px-4 py-3">
          <h2 className="font-semibold text-slate-100">Original extracted data</h2>
          <span className="text-xs text-slate-400">{originalData.length} entities</span>
        </header>
        <div className="ag-theme-alpine-dark min-h-0 flex-1">
          <AgGridReact rowData={originalData} columnDefs={originalColumns} defaultColDef={defaultColDef} getRowId={params => `${params.data.axis}-${params.data.id}`} />
        </div>
      </section>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-emerald-900/70 bg-slate-800 shadow-xl">
        <header className="flex items-center justify-between border-b border-emerald-800/60 bg-emerald-950/40 px-4 py-3">
          <div><h2 className="font-semibold text-emerald-300">Verified & optimized data</h2><p className="text-xs text-slate-400">Blue cells are editable; stress values stay fixed.</p></div>
          <span className="text-xs text-slate-400">{modifiedData.length} entities</span>
        </header>
        <div className="ag-theme-alpine-dark min-h-0 flex-1">
          <AgGridReact rowData={modifiedData} columnDefs={modifiedColumns} defaultColDef={defaultColDef} getRowId={params => `${params.data.axis}-${params.data.id}`} />
        </div>
      </section>
      <style>{`.editable-cell { background: rgba(37, 99, 235, .22) !important; border-left: 2px solid #60a5fa !important; }`}</style>
    </div>
  );
};
