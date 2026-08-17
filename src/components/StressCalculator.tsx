import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import type {
  ColDef,
  GridReadyEvent,
  CellValueChangedEvent,
} from "ag-grid-community";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Upload, FileDown, Calculator, Edit2, Check, X, EyeOff, Eye } from "lucide-react";
import {
  parseInputData,
  processStressData,
  calculateRow,
  calculateDiameterForSpacing,
} from "../utils/stressCalculations";
import type { StressData } from "../utils/stressCalculations";
import { DxfViewer } from "./DxfViewer";
// import { WorkedCalculations } from "./WorkedCalculations";

const CustomHeader = (props: any) => {
  const [sortState, setSortState] = useState<string | null>(null);

  useEffect(() => {
    const onSortChanged = () => {
      if (props.column.isSortAscending()) setSortState("asc");
      else if (props.column.isSortDescending()) setSortState("desc");
      else setSortState(null);
    };

    onSortChanged();
    props.column.addEventListener('sortChanged', onSortChanged);
    return () => {
      props.column.removeEventListener('sortChanged', onSortChanged);
    };
  }, [props.column]);

  const onSortRequested = (event: any) => {
    props.progressSort(event.shiftKey);
  };

  const onHideClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.api.setColumnsVisible([props.column.getId()], false);
  };

  let sortIcon = null;
  if (sortState === "asc") sortIcon = "↑";
  if (sortState === "desc") sortIcon = "↓";

  return (
    <div className="flex items-center justify-between w-full h-full group">
      <div className="flex items-center cursor-pointer flex-1" onClick={onSortRequested}>
        <span className="font-semibold text-sm truncate mr-1">{props.displayName}</span>
        {sortIcon && <span className="text-blue-500 text-xs">{sortIcon}</span>}
      </div>
      <button 
        onClick={onHideClick} 
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-opacity"
        title="Hide Column"
      >
        <EyeOff size={14} />
      </button>
    </div>
  );
};

const DiameterCellRenderer = (props: any) => {
  return (
    <div className="flex items-center justify-between h-full group px-1">
      <span>{props.valueFormatted ?? props.value}</span>
      <button
        onClick={() =>
          props.api.startEditingCell({
            rowIndex: props.node.rowIndex,
            colKey: props.colDef.field,
          })
        }
        className="text-slate-400 hover:text-blue-600 transition-colors p-1"
        title={`Edit ${props.colDef.field === "spacingOfBar" ? "Spacing" : "Diameter"}`}
      >
        <Edit2 size={14} />
      </button>
    </div>
  );
};

const DiameterCellEditor = forwardRef((props: any, ref) => {
  const [value, setValue] = useState(props.value);

  useImperativeHandle(ref, () => {
    return {
      getValue: () => Number(value),
    };
  });

  const handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.api.stopEditing();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.api.stopEditing(true);
  };

  return (
    <div className="flex items-center justify-between gap-1 h-full bg-white w-full">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full min-w-0 outline-none border-b-2 border-blue-500 bg-blue-50 px-1 h-full"
        autoFocus
      />
      <div className="flex items-center gap-1 shrink-0 bg-white">
        <button
          type="button"
          onMouseDown={handleSubmit}
          className="text-green-600 hover:bg-green-100 p-1 rounded transition-colors"
          title="Submit"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onMouseDown={handleCancel}
          className="text-red-600 hover:bg-red-100 p-1 rounded transition-colors"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
});

export const StressCalculator: React.FC = () => {
  // Input Parameters
  const [inputText, setInputText] = useState("");
  const [stripWidth, _setStripWidth] = useState<number>(1000);
  const [ptSlabDepth, setPtSlabDepth] = useState<number>(250);
  const [effDepth, setEffDepth] = useState<number>(250);
  const [diameter, setDiameter] = useState<number>(12);
  const [steelStress, _setSteelStress] = useState<number>(287.5);
  const [stressLimit, _setStressLimit] = useState<number>(3.5);


  const [rowData, setRowData] = useState<StressData[]>([]);
  const [gridApi, setGridApi] = useState<any>(null);

  const columnDefs: ColDef[] = [
    { field: "id", headerName: "ID", filter: true, flex: 1, minWidth: 100 },
    {
      field: "section",
      headerName: "Section",
      filter: true,
      flex: 1,
      minWidth: 100,
    },
    {
      field: "topStress",
      headerName: "Top Stress",
      filter: "agNumberColumnFilter",
      flex: 1,
      minWidth: 120,
      valueFormatter: (p) => p.value?.toFixed(3),
    },
    {
      field: "bottomStress",
      headerName: "Bottom Stress",
      filter: "agNumberColumnFilter",
      flex: 1,
      minWidth: 120,
      valueFormatter: (p) => p.value?.toFixed(3),
    },
    {
      field: "status",
      headerName: "Status",
      filter: true,
      flex: 1,
      minWidth: 100,
      cellStyle: (params) => {
        if (params.value === "Pass") {
          return { color: "green", fontWeight: "bold" };
        }
        return { color: "red", fontWeight: "bold" };
      },
    },
    {
      field: "ptSlabDepth",
      headerName: "PT Slab Depth",
      flex: 1,
      minWidth: 130,
    },
    { field: "effDepth", headerName: "Eff Depth (d)", flex: 1, minWidth: 130 },
    {
      field: "spacingOfBar",
      headerName: "SPACING OF BAR",
      editable: true,
      cellRenderer: DiameterCellRenderer,
      cellEditor: DiameterCellEditor,
      cellEditorPopup: false,
      flex: 1,
      minWidth: 150,
      valueFormatter: (p) => p.value?.toFixed(4),
    },
    {
      field: "diameter",
      headerName: "Input Diameter",
      editable: true,
      cellRenderer: DiameterCellRenderer,
      cellEditor: DiameterCellEditor,
      cellEditorPopup: false,
      flex: 1,
      minWidth: 160,
    },
    {
      field: "provide",
      headerName: "Provide",
      flex: 1,
      minWidth: 150,
      valueGetter: (params) => {
        if (!params.data) return "";
        const dia = params.data.diameter;
        const spc = params.data.spacingOfBar;
        let range = Math.floor(spc / 25) * 25;
        return `T${dia} @ ${range}`;
      },
    },
    {
      field: "stripWidthRebar",
      headerName: "STRIP WIDTH REBAR",
      flex: 1,
      minWidth: 170,
      valueFormatter: (p) => p.value?.toFixed(4),
    },
    {
      field: "rebar",
      headerName: "REBAR",
      flex: 1,
      minWidth: 100,
      valueFormatter: (p) => p.value?.toFixed(4),
    },
    {
      field: "noOfBar",
      headerName: "NO OF BAR",
      flex: 1,
      minWidth: 120,
      valueFormatter: (p) => p.value?.toFixed(4),
    },
    {
      field: "hMinusX",
      headerName: "H-X",
      flex: 1,
      minWidth: 100,
      valueFormatter: (p) => p.value?.toFixed(4),
    },
    {
      field: "x",
      headerName: "X",
      flex: 1,
      minWidth: 100,
      valueFormatter: (p) => p.value?.toFixed(4),
    },
    {
      field: "ft",
      headerName: "FT",
      flex: 1,
      minWidth: 100,
      valueFormatter: (p) => p.value?.toFixed(4),
    },
    {
      field: "astReq",
      headerName: "AST REQ",
      flex: 1,
      minWidth: 120,
      valueFormatter: (p) => p.value?.toFixed(4),
    },
  ];

  const handleParseData = useCallback(
    (textToParse?: string) => {
      const text = typeof textToParse === "string" ? textToParse : inputText;
      if (!text) return;
      try {
        const parsed = parseInputData(
          text, 
          diameter, 
          ptSlabDepth, 
          effDepth, 
          steelStress, 
          stressLimit, 
          stripWidth
        );
        setRowData(parsed);

        if (gridApi) {
          gridApi.setFilterModel(null);
          setTimeout(() => {
            gridApi.sizeColumnsToFit();
          }, 100);
        }
      } catch (error: any) {
        alert(`Error parsing data: ${error.message}`);
      }
    },
    [inputText, diameter, ptSlabDepth, effDepth, steelStress, stressLimit, stripWidth, gridApi],
  );

  const handleAdjustCalculations = useCallback(() => {
    const updatedData = processStressData(rowData, steelStress, stressLimit, stripWidth);
    setRowData(updatedData);
  }, [rowData, steelStress, stressLimit, stripWidth]);

  const getRowId = useCallback((params: any) => {
    return `${params.data.id}_${params.data.section}`;
  }, []);

  const onCellValueChanged = useCallback((params: CellValueChangedEvent) => {
    const field = params.colDef.field;
    const newVal = Number(params.newValue);
    if (Number.isNaN(newVal) || newVal <= 0) return;

    let updatedRow: StressData | null = null;
    if (field === "diameter") {
      const integerVal = Math.round(newVal);
      updatedRow = calculateRow(
        params.data.id,
        params.data.section,
        params.data.topStress,
        params.data.bottomStress,
        integerVal,
        params.data.ptSlabDepth,
        params.data.effDepth,
        false,
        steelStress,
        stressLimit,
        stripWidth
      );
    }

    if (field === "spacingOfBar") {
      const requiredDiameter = calculateDiameterForSpacing(
        params.data.astReq,
        newVal,
        stripWidth,
      );
      updatedRow = calculateRow(
        params.data.id,
        params.data.section,
        params.data.topStress,
        params.data.bottomStress,
        requiredDiameter,
        params.data.ptSlabDepth,
        params.data.effDepth,
        false,
        steelStress,
        stressLimit,
        stripWidth
      );
    }

    if (!updatedRow) return;

    params.api.applyTransaction({ update: [updatedRow] });
    setRowData((prev) => {
      const newData = [...prev];
      const index = newData.findIndex(
        (r) => r.id === params.data.id && r.section === params.data.section,
      );
      if (index !== -1) {
        newData[index] = updatedRow;
      }
      return newData;
    });
  }, [steelStress, stressLimit, stripWidth]);

  const onRowEditingStarted = useCallback((params: any) => {
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: ["actions"],
      force: true,
    });
  }, []);

  const onRowEditingStopped = useCallback((params: any) => {
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: ["actions"],
      force: true,
    });
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const nameLower = file.name.toLowerCase();

    if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const wb = XLSX.read(buffer, { type: 'array' });
          const sheetName = wb.SheetNames[0];
          const sheet = wb.Sheets[sheetName];
          const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          const validLines: string[] = [];
          for (const r of rawRows) {
            if (!r || r.length < 4) continue;
            // Filter non-empty cells
            const cells = r.map(c => String(c ?? '').trim()).filter(c => c.length > 0);
            if (cells.length >= 4) {
              const topVal = Number(cells[2]);
              const botVal = Number(cells[3]);
              if (!Number.isNaN(topVal) && !Number.isNaN(botVal)) {
                validLines.push(`${cells[0]}\t${cells[1]}\t${cells[2]}\t${cells[3]}`);
              }
            }
          }

          if (validLines.length === 0) {
            return alert("No valid data rows (ID, Section, Top, Bot) found in Excel sheet.");
          }

          const formattedText = validLines.join('\n');
          setInputText(formattedText);
          handleParseData(formattedText);
        } catch (err: any) {
          alert(`Error reading Excel file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      file
        .text()
        .then((textContent) => {
          const cleanedText = textContent
            .replaceAll('"', "")
            .replaceAll("\0", "");
          setInputText(cleanedText);
          handleParseData(cleanedText);
        })
        .catch((readError) => {
          alert(`Error reading file: ${readError}`);
        });
    }
  };


  const getFilteredData = () => {
    if (!gridApi) return rowData;
    const displayedData: StressData[] = [];
    gridApi.forEachNodeAfterFilterAndSort((node: any) => {
      if (node.data) displayedData.push(node.data);
    });
    return displayedData;
  };

  const getExportFilename = (extension: string) => {
    const dateStr = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    });
    const safeDate = dateStr
      .replaceAll("/", "-")
      .replaceAll("\\", "-")
      .replaceAll(", ", "_")
      .replaceAll(":", "-");
    return `stress_report_${safeDate}.${extension}`;
  };

  const exportPdf = () => {
    const dataToExport = getFilteredData();
    if (dataToExport.length === 0) return alert("No data to export.");

    const doc = new jsPDF("landscape");
    autoTable(doc, {
      head: [
        [
          "ID",
          "Sec",
          "Top",
          "Bot",
          "Status",
          "PT Slab",
          "Eff (d)",
          "H-X",
          "X",
          "FT",
          "AST REQ",
          "REBAR",
          "NO BAR",
          "SPACING",
          "PROVIDE",
        ],
      ],
      body: dataToExport.map((row) => {
        let range = Math.floor(row.spacingOfBar / 25) * 25;
        return [
          row.id,
          row.section,
          row.topStress.toFixed(3),
          row.bottomStress.toFixed(3),
          row.status,
          row.ptSlabDepth,
          row.effDepth,
          row.hMinusX.toFixed(2),
          row.x.toFixed(2),
          row.ft.toFixed(2),
          row.astReq.toFixed(2),
          row.rebar.toFixed(2),
          row.noOfBar.toFixed(2),
          row.spacingOfBar.toFixed(1),
          `T${row.diameter} @ ${range}`,
        ];
      }),
      styles: { fontSize: 7 },
    });

    doc.save(getExportFilename("pdf"));
  };

  const exportExcel = () => {
    const dataToExport = getFilteredData();
    if (dataToExport.length === 0) return alert("No data to export.");

    const mappedData = dataToExport.map((row) => {
      let range = Math.floor(row.spacingOfBar / 25) * 25;
      return {
        ...row,
        Provide: `T${row.diameter} @ ${range}`,
      };
    });

    const ws = XLSX.utils.json_to_sheet(mappedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stress Data");
    XLSX.writeFile(wb, getExportFilename("xlsx"));
  };

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 150);
  };

  const filterFailed = () => {
    if (gridApi) {
      gridApi.setFilterModel({
        status: {
          type: "equals",
          filter: "Fail",
        },
      });
    }
  };

  const clearFilter = () => {
    if (gridApi) {
      gridApi.setFilterModel(null);
    }
  };

  const resetColumns = () => {
    if (gridApi) {
      const allColumns = gridApi.getColumns();
      if (allColumns) {
        gridApi.setColumnsVisible(allColumns, true);
      }
    }
  };

  // Summary Metrics (Uncomment when enabling Summary block)
  /*
  const totalSections = rowData.length;
  const failSections = rowData.filter(
    r => r.topStress > stressLimit || r.bottomStress > stressLimit || r.status === 'Fail'
  );
  const passCount = totalSections - failSections.length;
  const peakAst = rowData.length > 0 ? Math.max(...rowData.map(r => r.astReq)) : 0;
  const closestSp = rowData.length > 0 ? Math.min(...rowData.map(r => r.spacingOfBar)) : 0;
  const closestSpRound = closestSp > 0 ? Math.floor(closestSp / 25) * 25 : 0;

  const govRow = rowData.length > 0
    ? [...rowData].sort((a,b) => Math.max(b.topStress, b.bottomStress) - Math.max(a.topStress, a.bottomStress))[0]
    : null;
  const govStress = govRow ? Math.max(govRow.topStress, govRow.bottomStress) : 0;
  const govProvide = govRow ? `T${govRow.diameter} @ ${Math.floor(govRow.spacingOfBar / 25) * 25} mm` : '';
  */


  return (
    <div className="flex flex-col min-h-screen w-full bg-slate-50 p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Tensile stress calculation and reinforcement
        </h1>
        <div className="flex gap-3">
          <button
            onClick={exportPdf}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors text-sm font-medium"
          >
            <FileDown size={18} />
            Export PDF
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors text-sm font-medium"
          >
            <FileDown size={18} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Summary Section (Uncomment below block to enable in future) */}
      {/* 
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
        Summary
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sections</div>
            <div className="text-xl font-extrabold text-slate-800 font-mono mt-0.5">{totalSections}</div>
          </div>
          <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Pass</div>
            <div className="text-xl font-extrabold text-emerald-700 font-mono mt-0.5">{passCount}</div>
          </div>
          <div className="bg-red-50/60 p-3 rounded-lg border border-red-200">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Fail (&gt; {stressLimit} MPa)</div>
            <div className={`text-xl font-extrabold font-mono mt-0.5 ${failSections.length > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {failSections.length}
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Peak A<sub>st</sub> req</div>
            <div className="text-xl font-extrabold text-blue-700 font-mono mt-0.5">{peakAst > 0 ? peakAst.toFixed(0) : 0} <span className="text-xs font-normal text-slate-500">mm²</span></div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Closest Spacing</div>
            <div className="text-xl font-extrabold text-amber-600 font-mono mt-0.5">{closestSpRound > 0 ? closestSpRound : 0} <span className="text-xs font-normal text-slate-500">mm</span></div>
          </div>
        </div>

        {govRow && (
          <div className="pt-2 text-xs border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-700 font-sans">
            <div>
              Governing section <strong className="font-mono text-slate-900">{govRow.id}</strong> (Sec {govRow.section}) &nbsp;&middot;&nbsp; &sigma; = <strong className="font-mono text-slate-900">{govStress.toFixed(3)} N/mm²</strong> &nbsp;&middot;&nbsp; provide <strong className="font-mono text-emerald-800">{govProvide}</strong> giving {govRow.astReq.toFixed(0)} mm² over a {stripWidth} mm strip
            </div>
            <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase shrink-0 ${failSections.length > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {failSections.length > 0 ? 'Action Required' : 'All Pass'}
            </span>
          </div>
        )}
      </div>
      */}


      {/* Inputs & Controls Section */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full lg:w-1/4 flex flex-col h-fit space-y-4">
          <h2 className="text-xl font-semibold text-slate-700">Data Input</h2>

          <div>
            <label htmlFor="stress-input" className="block text-sm font-medium text-slate-600 mb-1">
              Paste Data (ID, Section, Top, Bottom)
            </label>
            <textarea
              id="stress-input"
              className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="1C-2&#9;12&#9;4.399&#9;-4.466&#10;1-1&#9;1&#9;3.778&#9;-3.716"
            />
          </div>

          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex flex-col items-center justify-center">
              <Upload className="w-5 h-5 mb-1 text-slate-500" />
              <p className="text-xs text-slate-500 font-medium">Upload .txt, .csv, or .xlsx file</p>
            </div>
            <input type="file" className="hidden" accept=".txt,.csv,.xlsx,.xls" onChange={handleFileUpload} />
          </label>


          <div className="grid grid-cols-2 gap-3 text-xs pt-2">
            <div hidden = {true}>
              <label className="block text-slate-600 mb-1 font-medium">Strip width (b)</label>
              <input disabled={true}
                type="number"
                value={stripWidth}
                // onChange={(e) => setStripWidth(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">PT Slab Depth (D)</label>
              <input
                type="number"
                value={ptSlabDepth}
                onChange={(e) => setPtSlabDepth(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Eff Depth (d)</label>
              <input
                type="number"
                value={effDepth}
                onChange={(e) => setEffDepth(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-medium">Diameter (&Oslash;)</label>
              <input
                type="number"
                value={diameter}
                onChange={(e) => setDiameter(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono"
              />
            </div>
            <div hidden={true}>
              <label className="block text-slate-600 mb-1 font-medium">Steel stress (f<sub>s</sub>)</label>
              <input disabled={true}
                type="number"
                value={steelStress}
                // onChange={(e) => setSteelStress(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono"
              />
            </div>
            <div hidden={true}>
              <label className="block text-slate-600 mb-1 font-medium">Stress limit (MPa)</label>
              <input disabled={true}
                type="number"
                step="0.1"
                value={stressLimit}
               // onChange={(e) => setStressLimit(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono font-bold text-red-600"
              />
            </div>
          </div>

          <button
            onClick={() => handleParseData()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg shadow-sm transition-colors text-sm mt-2"
          >
            Parse Data & Calculate
          </button>
        </div>

        {/* Right Column: Grid Results Table */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full lg:w-3/4 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-700">Results</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={filterFailed}
                className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                Show Failed
              </button>
              <button
                onClick={clearFilter}
                className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                Clear Filter
              </button>
              <button
                onClick={resetColumns}
                className="flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                title="Show all hidden columns"
              >
                <Eye size={16} />
                Reset Columns
              </button>
              <button
                onClick={handleAdjustCalculations}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md shadow-sm transition-colors text-sm font-medium ml-2"
              >
                <Calculator size={16} />
                Auto - Adjust Failures
              </button>
            </div>
          </div>

          {/* Ag-Grid Container with Fixed Explicit Pixel Height (520px) */}
          <div className="w-full h-[520px] bg-white ag-theme-alpine rounded-lg overflow-hidden border border-slate-200" style={{ height: '520px', width: '100%' }}>
            <AgGridReact
              rowData={rowData}
              getRowId={getRowId}
              columnDefs={columnDefs}
              onGridReady={onGridReady}
              onCellValueChanged={onCellValueChanged}
              onRowEditingStarted={onRowEditingStarted}
              onRowEditingStopped={onRowEditingStopped}
              animateRows={true}
              rowSelection="multiple"
              defaultColDef={{
                sortable: true,
                resizable: true,
                headerComponent: CustomHeader,
              }}
            />
          </div>
        </div>
      </div>

      {/* Step 5: DXF Plan Markup & SVG Interactive Preview */}
      <DxfViewer stressRows={rowData} barDia={diameter} stressLimit={stressLimit} />

      {/* Step 6: Worked Calculations for Governing Sections (Uncomment below to enable) */}
      {/* <WorkedCalculations data={rowData} /> */}
    </div>
  );
};
