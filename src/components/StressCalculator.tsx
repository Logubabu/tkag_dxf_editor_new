import React, { useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { ColDef, GridReadyEvent } from 'ag-grid-community';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Upload, FileDown, Calculator } from 'lucide-react';
import { parseInputData, processStressData } from '../utils/stressCalculations';
import type { StressData } from '../utils/stressCalculations';

export const StressCalculator: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [diameter, setDiameter] = useState<number>(12);
  const [space, setSpace] = useState<number>(200);
  const [rowData, setRowData] = useState<StressData[]>([]);

  const columnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', filter: true, flex: 1 },
    { field: 'section', headerName: 'Section', filter: true, flex: 1 },
    { field: 'topStress', headerName: 'Top Stress', filter: true, flex: 1 },
    { field: 'bottomStress', headerName: 'Bottom Stress', filter: true, flex: 1 },
    { field: 'diameter', headerName: 'Diameter', editable: true, flex: 1 },
    { field: 'space', headerName: 'Space', editable: true, flex: 1 },
    { 
      field: 'status', 
      headerName: 'Status',
      flex: 1,
      cellStyle: (params) => {
        if (params.value === 'Pass') {
          return { color: 'green', fontWeight: 'bold' };
        }
        return { color: 'red', fontWeight: 'bold' };
      }
    }
  ];

  const handleParseData = useCallback(() => {
    if (!inputText) return;
    const parsed = parseInputData(inputText, diameter, space);
    setRowData(parsed);
  }, [inputText, diameter, space]);

  const handleAdjustCalculations = useCallback(() => {
    const updatedData = processStressData(rowData);
    setRowData(updatedData);
  }, [rowData]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setInputText(text);
      };
      reader.readAsText(file);
    }
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['ID', 'Section', 'Top Stress', 'Bottom Stress', 'Diameter', 'Space', 'Status']],
      body: rowData.map(row => [row.id, row.section, row.topStress, row.bottomStress, row.diameter, row.space, row.status]),
    });
    doc.save('stress_report.pdf');
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rowData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stress Data");
    XLSX.writeFile(wb, "stress_report.xlsx");
  };

  const onGridReady = (params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Stress Calculation Tool</h1>
        <div className="flex gap-3">
          <button 
            onClick={exportPdf}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <FileDown size={18} />
            Export PDF
          </button>
          <button 
            onClick={exportExcel}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <FileDown size={18} />
            Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 lg:col-span-1 flex flex-col h-full">
          <h2 className="text-xl font-semibold mb-4 text-slate-700">Data Input</h2>
          
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Paste Data (ID, Section, Top, Bottom)</label>
              <textarea 
                className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-sm"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="1\tSec-A\t2.5\t1.5\n2\tSec-B\t4.0\t2.0"
              />
            </div>
            
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-6 h-6 mb-2 text-slate-500" />
                  <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span> txt file</p>
                </div>
                <input type="file" className="hidden" accept=".txt,.csv" onChange={handleFileUpload} />
              </label>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Diameter</label>
                <input 
                  type="number" 
                  value={diameter}
                  onChange={(e) => setDiameter(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Space</label>
                <input 
                  type="number" 
                  value={space}
                  onChange={(e) => setSpace(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <button 
              onClick={handleParseData}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg shadow-sm transition-colors mt-4"
            >
              Parse Data & Calculate
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-700">Results</h2>
            <button 
              onClick={handleAdjustCalculations}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors text-sm font-medium"
            >
              <Calculator size={16} />
              Auto-Adjust Failures
            </button>
          </div>
          
          <div className="flex-1 min-h-[400px] w-full bg-white ag-theme-alpine rounded-lg overflow-hidden border border-slate-200">
            <AgGridReact
              rowData={rowData}
              columnDefs={columnDefs}
              onGridReady={onGridReady}
              animateRows={true}
              rowSelection="multiple"
              defaultColDef={{
                sortable: true,
                resizable: true,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
