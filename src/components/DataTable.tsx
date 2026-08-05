import React, { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ValueSetterParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { BaseEntity } from '../utils/dxfProcessor';
import { calculateFields } from '../utils/calcUtils';
import type { GlobalMaterialProps } from '../utils/calcUtils';

interface DataTableProps {
  data: BaseEntity[];
  onDataChange: (newData: BaseEntity[]) => void;
  materials: GlobalMaterialProps;
}

export const DataTable: React.FC<DataTableProps> = ({ data, onDataChange, materials }) => {
  const gridRef = useRef<AgGridReact>(null);

  const updateEntityField = useCallback((dataItem: BaseEntity, field: string, newValue: any): boolean => {
    const value = Number(newValue);
    if (!Number.isFinite(value) || value < 0 || dataItem[field as keyof BaseEntity] === value) return false;
    
    const updatedEntity = { ...dataItem, [field]: value };
    const calculatedEntity = calculateFields(updatedEntity, field, materials);
    
    const newData = data.map(item => item.id === dataItem.id ? calculatedEntity : item);
    onDataChange(newData);
    return true;
  }, [data, materials, onDataChange]);

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'axis', headerName: 'AXIS', width: 80, pinned: 'left' },
    { field: 'id', headerName: 'STRIP ID MARK', width: 150, pinned: 'left' },
    { 
      field: 'appliedMoment', 
      headerName: 'MOMENT (kNm)', 
      editable: true,
      cellClass: 'editable-ag-cell font-bold text-amber-400',
      width: 150,
      valueSetter: (params: ValueSetterParams) => updateEntityField(params.data, 'appliedMoment', params.newValue)
    },
    { field: 'stripWidth', headerName: 'STRIP WIDTH', width: 120 },
    { field: 'topStress', headerName: 'TOP STRESS', valueFormatter: p => p.value?.toFixed(4) || '-' },
    { field: 'bottomStress', headerName: 'BOTTOM STRESS', valueFormatter: p => p.value?.toFixed(4) || '-' },
    { field: 'area', headerName: 'AREA', valueFormatter: p => p.value ? p.value.toExponential(2) : '-' },
    { field: 'centroidY', headerName: 'CENTROID Y', valueFormatter: p => p.value?.toFixed(2) || '-' },
    { field: 'momentOfInertia', headerName: 'INERTIA (I)', valueFormatter: p => p.value ? p.value.toExponential(2) : '-' },
    { 
      field: 'ptSlabDepth', 
      headerName: 'PT SLAB DEPTH (D)', 
      editable: true,
      cellClass: 'editable-ag-cell',
      valueSetter: (params: ValueSetterParams) => updateEntityField(params.data, 'ptSlabDepth', params.newValue)
    },
    { field: 'effDepth', headerName: 'EFF DEPTH (d)', width: 130 },
    { field: 'astReq', headerName: 'AST REQ', valueFormatter: p => p.value?.toFixed(2) || '-' },
    { field: 'rebar', headerName: 'REBAR', width: 100 },
    { field: 'noOfBar', headerName: 'NO OF BAR', width: 120 },
    { field: 'spacingOfBar', headerName: 'SPACING OF BAR', width: 150 },
    { 
      field: 'stressPassFail', 
      headerName: 'STRESS PASS/FAIL>3.5',
      width: 180,
      cellRenderer: (params: any) => {
        const pass = params.value;
        return (
          <span className={`px-2 py-1 rounded-md text-xs font-bold ${pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {pass ? 'PASS' : 'FAIL'}
          </span>
        );
      }
    },
    { field: 'stripWidthRebar', headerName: 'STRIP WIDTH REBAR', width: 180 },
    { 
      field: 'inputDiameterOfBar', 
      headerName: 'INPUT DIA OF BAR', 
      editable: true,
      cellClass: 'editable-ag-cell',
      width: 160,
      valueSetter: (params: ValueSetterParams) => updateEntityField(params.data, 'inputDiameterOfBar', params.newValue)
    },
    { 
      field: 'spacing', 
      headerName: 'SPACING', 
      editable: true,
      cellClass: 'editable-ag-cell',
      width: 120,
      valueSetter: (params: ValueSetterParams) => updateEntityField(params.data, 'spacing', params.newValue)
    },
  ], [updateEntityField]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  if (data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 h-full">
        <div className="w-16 h-16 border-2 border-dashed border-slate-600 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl opacity-50">📂</span>
        </div>
        <p>No entity data available. Upload DXF files to begin.</p>
      </div>
    );
  }

  return (
    <div className="ag-theme-alpine-dark w-full h-full" style={{ '--ag-background-color': 'transparent', '--ag-header-background-color': '#1e293b', '--ag-odd-row-background-color': '#0f172a', '--ag-border-color': '#334155' } as React.CSSProperties}>
      <AgGridReact
        ref={gridRef}
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={true}
        rowSelection="multiple"
        suppressCellFocus={false}
      />
      <style>{`
        .editable-ag-cell {
          background-color: rgba(59, 130, 246, 0.1) !important;
          border-left: 2px solid #3b82f6 !important;
        }
        .editable-ag-cell:hover {
          background-color: rgba(59, 130, 246, 0.2) !important;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
