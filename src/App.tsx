import { useState } from 'react';
import { Upload, Download, Settings, Loader2, CheckCircle, XCircle, BarChart3, Database } from 'lucide-react';
import axios from 'axios';
import { ComparisonGrid } from './components/ComparisonGrid';
import { exportToExcel } from './utils/exportUtils';

const API_BASE_URL = 'http://127.0.0.1:8000';

function App() {
  const [originalEntities, setOriginalEntities] = useState<any[]>([]);
  const [modifiedEntities, setModifiedEntities] = useState<any[]>([]);
  
  const [fileX, setFileX] = useState<File | null>(null);
  const [fileY, setFileY] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const handleUploadFiles = async () => {
    if (!fileX || !fileY) return;
    setLoading(true);
    
    try {
      const formDataX = new FormData();
      formDataX.append('file', fileX);
      formDataX.append('axis', 'X');
      
      const formDataY = new FormData();
      formDataY.append('file', fileY);
      formDataY.append('axis', 'Y');

      const [resX, resY] = await Promise.all([
        axios.post(`${API_BASE_URL}/api/upload`, formDataX),
        axios.post(`${API_BASE_URL}/api/upload`, formDataY)
      ]);

      const combined = [...resX.data.entities, ...resY.data.entities];
      setOriginalEntities(combined);
      // Initialize modified entities identical to original
      setModifiedEntities(JSON.parse(JSON.stringify(combined)));
      setCalculated(false);
    } catch (err) {
      console.error(err);
      alert("Error uploading files to backend");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async (autoCorrect = true) => {
    setLoading(true);
    try {
      // Keep any corrections made in the verification grid when recalculating.
      const res = await axios.post(`${API_BASE_URL}/api/calculate?auto_correct=${autoCorrect}`, modifiedEntities);
      setModifiedEntities(res.data.entities);
      setCalculated(true);
    } catch (err) {
      console.error(err);
      alert("Error performing engineering calculations");
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = (newData: any[]) => {
    setModifiedEntities(newData);
  };

  const handleExportExcel = () => {
    exportToExcel(originalEntities, modifiedEntities);
  };

  const downloadUpdatedDxf = async (file: File, axis: 'X' | 'Y') => {
    const formData = new FormData();
    formData.append('axis', axis);
    formData.append('original_dxf', file);
    formData.append('modified_data', JSON.stringify(modifiedEntities.filter(entity => entity.axis === axis)));

    const response = await axios.post(`${API_BASE_URL}/api/export-dxf`, formData, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `updated_${axis}_${file.name}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDxf = async () => {
    if (!fileX || !fileY) return;
    setLoading(true);
    try {
      await Promise.all([downloadUpdatedDxf(fileX, 'X'), downloadUpdatedDxf(fileY, 'Y')]);
    } catch (err) {
      console.error(err);
      alert('Error generating updated DXF files');
    } finally {
      setLoading(false);
    }
  };

  const summary = {
    total: modifiedEntities.length,
    passed: modifiedEntities.filter(e => e.status === 'PASS').length,
    failed: modifiedEntities.filter(e => e.status === 'FAIL').length,
  };

  return (
    <div className="min-h-screen bg-[#1e1e24] text-slate-100 font-sans flex flex-col">
      {/* Top Navbar */}
      <header className="bg-[#2d2d35] border-b border-[#3f3f4a] p-3 flex justify-between items-center z-10 shadow-md">
        <div className="flex items-center gap-4 pl-2">
          <div className="bg-emerald-600 p-1.5 rounded shadow-lg">
            <Database className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-white">DXF Auto-Optimizer Pro</h1>
            <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Enterprise Edition</div>
          </div>
        </div>
        <div className="flex gap-3 pr-2">
           <button 
            className="flex items-center gap-2 px-4 py-2 bg-[#3f3f4a] hover:bg-[#4a4a56] text-white rounded transition-colors text-sm font-semibold border border-[#525260] disabled:opacity-50"
            disabled={!calculated}
            onClick={handleExportExcel}
          >
            <Download size={16} />
            Export Excel
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-sm font-semibold shadow-lg shadow-blue-900/50 disabled:opacity-50"
            disabled={!calculated || loading}
            onClick={handleExportDxf}
          >
            <Download size={16} />
            Generate Updated DXF
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 bg-[#25252d] border-r border-[#3f3f4a] flex flex-col z-10 shadow-xl">
          <div className="p-5 flex flex-col gap-6">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Upload size={14} /> Import DXF
              </h2>
              
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-300 font-medium">X-Axis Drawing</label>
                  <label className="flex items-center justify-center gap-2 w-full py-2 bg-[#1e1e24] text-slate-300 text-sm rounded border border-[#3f3f4a] hover:border-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors">
                    <Upload size={14} /> {fileX ? fileX.name : 'Select File'}
                    <input type="file" accept=".dxf" className="hidden" onChange={(e) => setFileX(e.target.files?.[0] || null)} />
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-300 font-medium">Y-Axis Drawing</label>
                  <label className="flex items-center justify-center gap-2 w-full py-2 bg-[#1e1e24] text-slate-300 text-sm rounded border border-[#3f3f4a] hover:border-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors">
                    <Upload size={14} /> {fileY ? fileY.name : 'Select File'}
                    <input type="file" accept=".dxf" className="hidden" onChange={(e) => setFileY(e.target.files?.[0] || null)} />
                  </label>
                </div>

                <button
                  onClick={handleUploadFiles}
                  disabled={!fileX || !fileY || loading}
                  className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-bold shadow-lg shadow-emerald-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && !originalEntities.length ? <Loader2 size={16} className="animate-spin" /> : null}
                  Read DXF Files
                </button>
              </div>
            </div>

            {originalEntities.length > 0 && (
              <div className="pt-4 border-t border-[#3f3f4a]">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Settings size={14} /> Optimization
                </h2>
                <button
                  onClick={() => handleCalculate(!calculated)}
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-bold shadow-lg shadow-blue-900/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && originalEntities.length ? <Loader2 size={16} className="animate-spin" /> : null}
                  {calculated ? 'Reverify Edited Values' : 'Run Auto-Correction'}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col bg-[#1e1e24] overflow-hidden relative">
          
          {/* Dashboard Cards */}
          {originalEntities.length > 0 && (
             <div className="p-4 grid grid-cols-4 gap-4 border-b border-[#3f3f4a] bg-[#25252d]">
                <div className="bg-[#2d2d35] border border-[#3f3f4a] rounded p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Beams</div>
                    <div className="text-2xl font-bold text-slate-100">{summary.total}</div>
                  </div>
                  <BarChart3 className="text-blue-500 opacity-50" size={32} />
                </div>
                <div className="bg-[#2d2d35] border border-[#3f3f4a] rounded p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Passed (Safe)</div>
                    <div className="text-2xl font-bold text-emerald-400">{summary.passed}</div>
                  </div>
                  <CheckCircle className="text-emerald-500 opacity-50" size={32} />
                </div>
                <div className="bg-[#2d2d35] border border-[#3f3f4a] rounded p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Failed (Critical)</div>
                    <div className="text-2xl font-bold text-red-400">{summary.failed}</div>
                  </div>
                  <XCircle className="text-red-500 opacity-50" size={32} />
                </div>
             </div>
          )}

          <div className="flex-1 overflow-hidden">
            {originalEntities.length > 0 ? (
              <ComparisonGrid 
                originalData={originalEntities} 
                modifiedData={modifiedEntities} 
                onDataChange={handleDataChange} 
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 flex-col gap-4">
                <Database size={64} className="opacity-20" />
                <p className="font-medium tracking-wide">Upload X and Y DXF files to begin structural analysis.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
