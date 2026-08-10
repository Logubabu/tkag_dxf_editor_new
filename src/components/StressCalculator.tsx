import React, {
  useState,
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
import { Upload, FileDown, Calculator, Edit2, Check, X } from "lucide-react";
import {
  parseInputData,
  processStressData,
  calculateRow,
  calculateDiameterForSpacing,
} from "../utils/stressCalculations";
import type { StressData } from "../utils/stressCalculations";

const DiameterCellRenderer = (props: any) => {
  return (
    <div className="flex items-center justify-between h-full group px-1">
      <span>{props.value} </span>
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
  }, [value]);

  const handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newVal = Number(value);
    const integerVal = Math.round(newVal);
    if (Number.isNaN(integerVal) || integerVal <= 0 || integerVal === props.value) {
      props.api.stopEditing(false);
      return;
    }

    let updatedRow: StressData | null = null;
    if (props.colDef.field === "diameter") {
      updatedRow = calculateRow(
        props.data.id,
        props.data.section,
        props.data.topStress,
        props.data.bottomStress,
        integerVal,
        props.data.ptSlabDepth,
        props.data.effDepth,
      );
    }

    if (props.colDef.field === "spacingOfBar") {
      const requiredDiameter = calculateDiameterForSpacing(
        props.data.astReq,
        newVal,
        1000,
      );
      updatedRow = calculateRow(
        props.data.id,
        props.data.section,
        props.data.topStress,
        props.data.bottomStress,
        requiredDiameter,
        props.data.ptSlabDepth,
        props.data.effDepth,
      );
    }

    if (updatedRow) {
      props.node.setData(updatedRow);
    }
    props.api.stopEditing(false);
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
  const [inputText, setInputText] = useState("");
  const [diameter, setDiameter] = useState<number>(12);
  const [ptSlabDepth, setPtSlabDepth] = useState<number>(250);
  const [effDepth, setEffDepth] = useState<number>(250);
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
    },
    {
      field: "bottomStress",
      headerName: "Bottom Stress",
      filter: "agNumberColumnFilter",
      flex: 1,
      minWidth: 120,
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
      field: "stripWidthRebar",
      headerName: "STRIP WIDTH REBAR",
      flex: 1,
      minWidth: 170,
      valueFormatter: (p) => p.value?.toFixed(4),
    },
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
      cellEditorPopup: false, // Force inline
      flex: 1,
      minWidth: 160,
    },
  ];

  const handleParseData = useCallback(
    (textToParse?: string) => {
      const text = typeof textToParse === "string" ? textToParse : inputText;
      if (!text) return;
      try {
        const parsed = parseInputData(text, diameter, ptSlabDepth, effDepth);
        setRowData(parsed);

        // Clear any existing filters when parsing new data
        if (gridApi) {
          gridApi.setFilterModel(null);
        }
      } catch (error: any) {
        alert(`Error parsing data: ${error.message}`);
      }
    },
    [inputText, diameter, ptSlabDepth, effDepth, gridApi],
  );

  const handleAdjustCalculations = useCallback(() => {
    const updatedData = processStressData(rowData);
    setRowData(updatedData);
  }, [rowData]);

  const getRowId = useCallback((params: any) => {
    // A unique ID is required for ag-Grid to properly merge React state updates
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
      );
    }

    if (field === "spacingOfBar") {
      const requiredDiameter = calculateDiameterForSpacing(
        params.data.astReq,
        newVal,
        1000,
      );
      updatedRow = calculateRow(
        params.data.id,
        params.data.section,
        params.data.topStress,
        params.data.bottomStress,
        requiredDiameter,
        params.data.ptSlabDepth,
        params.data.effDepth,
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
  }, []);

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
          "WIDTH REBAR",
          "SPACING",
        ],
      ],
      body: dataToExport.map((row) => [
        row.id,
        row.section,
        row.topStress,
        row.bottomStress,
        row.status,
        row.ptSlabDepth,
        row.effDepth,
        row.hMinusX.toFixed(4),
        row.x.toFixed(4),
        row.ft.toFixed(4),
        row.astReq.toFixed(4),
        row.rebar.toFixed(4),
        row.noOfBar.toFixed(4),
        row.stripWidthRebar.toFixed(4),
        row.spacingOfBar.toFixed(4),
      ]),
      styles: { fontSize: 7 },
    });
    doc.save(getExportFilename("pdf"));
  };

  const exportExcel = () => {
    const dataToExport = getFilteredData();
    if (dataToExport.length === 0) return alert("No data to export.");

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stress Data");
    XLSX.writeFile(wb, getExportFilename("xlsx"));
  };

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
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

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          {" "}
          Stress Calculation Tool{" "}
        </h1>
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

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full lg:w-1/5 flex flex-col h-fit">
          <h2 className="text-xl font-semibold mb-4 text-slate-700">
            {" "}
            Data Input{" "}
          </h2>

          <div className="space-y-4 flex-1">
            <div>
              <label
                htmlFor="stress-input"
                className="block text-sm font-medium text-slate-600 mb-1"
              >
                {" "}
                Paste Data(ID, Section, Top, Bottom){" "}
              </label>
              <textarea
                id="stress-input"
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
                  <p className="text-sm text-slate-500">
                    {" "}
                    <span className="font-semibold"> Click to upload </span> txt
                    or csv file
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label
                  htmlFor="pt-slab-depth"
                  className="block text-sm font-medium text-slate-600 mb-1"
                >
                  {" "}
                  PT Slab Depth(D){" "}
                </label>
                <input
                  id="pt-slab-depth"
                  type="number"
                  value={ptSlabDepth}
                  onChange={(e) => setPtSlabDepth(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="eff-depth"
                  className="block text-sm font-medium text-slate-600 mb-1"
                >
                  {" "}
                  Eff Depth(d){" "}
                </label>
                <input
                  id="eff-depth"
                  type="number"
                  value={effDepth}
                  onChange={(e) => setEffDepth(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="diameter-input"
                  className="block text-sm font-medium text-slate-600 mb-1"
                >
                  {" "}
                  Diameter{" "}
                </label>
                <input
                  id="diameter-input"
                  type="number"
                  value={diameter}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (!Number.isNaN(parsed)) {
                      setDiameter(Math.round(parsed));
                    }
                  }}
                  step={1}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => handleParseData()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg shadow-sm transition-colors mt-4"
            >
              Parse Data & Calculate
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full lg:w-4/5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-700"> Results </h2>
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
                onClick={handleAdjustCalculations}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md shadow-sm transition-colors text-sm font-medium ml-2"
              >
                <Calculator size={16} />
                Auto - Adjust Failures
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[400px] w-full bg-white ag-theme-alpine rounded-lg overflow-hidden border border-slate-200">
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
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
