import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Download, Play, RefreshCw, Trash2, Instagram, Search, AlertTriangle, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { checkUsernameWithGemini } from './services/geminiService';
import { UsernameResult, CheckStatus, PageStatus, ProcessingStats } from './types';
import { StatusBadge } from './components/StatusBadge';
import { cn } from './utils/cn';

// Helper to generate a random ID
const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  const [usernames, setUsernames] = useState<UsernameResult[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const stopProcessingRef = useRef(false);

  // Stats calculation
  const stats: ProcessingStats = usernames.reduce(
    (acc, curr) => {
      acc.total++;
      if (curr.status === CheckStatus.COMPLETED || curr.status === CheckStatus.FAILED) acc.processed++;
      if (curr.pageStatus === PageStatus.OPEN) acc.open++;
      if (curr.pageStatus === PageStatus.CLOSED) acc.closed++;
      if (curr.status === CheckStatus.FAILED) acc.errors++;
      return acc;
    },
    { total: 0, processed: 0, open: 0, closed: 0, errors: 0 }
  );

  useEffect(() => {
    if (usernames.length > 0) {
      setProgress((stats.processed / usernames.length) * 100);
    } else {
      setProgress(0);
    }
  }, [stats.processed, usernames.length]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

      // Flatten and extract likely usernames (basic regex or just first column)
      const extractedUsernames: UsernameResult[] = [];
      data.forEach((row) => {
        row.forEach((cell) => {
          if (typeof cell === 'string' && cell.trim().length > 0) {
            // Basic cleanup: remove @, spaces, url parts
            const clean = cell.replace(/@/g, '').replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/\//g, '').trim();
            if (clean) {
               extractedUsernames.push({
                id: generateId(),
                username: clean,
                status: CheckStatus.IDLE,
                pageStatus: PageStatus.UNKNOWN
              });
            }
          }
        });
      });
      setUsernames((prev) => [...prev, ...extractedUsernames]);
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
  };

  const handleManualAdd = () => {
    if (!inputText.trim()) return;
    const lines = inputText.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
    const newItems = lines.map(u => ({
      id: generateId(),
      username: u.replace(/@/g, ''),
      status: CheckStatus.IDLE,
      pageStatus: PageStatus.UNKNOWN
    }));
    setUsernames(prev => [...prev, ...newItems]);
    setInputText('');
  };

  const handleClear = () => {
    setUsernames([]);
    setProgress(0);
    stopProcessingRef.current = true;
  };

  const startProcessing = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;

    // Process queue
    // We filter for IDLE or FAILED to retry
    const queue = usernames.filter(u => u.status === CheckStatus.IDLE || u.status === CheckStatus.FAILED);
    
    // Helper to update a single item
    const updateItem = (id: string, updates: Partial<UsernameResult>) => {
      setUsernames(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    // Process one by one (or strictly limited concurrency) to avoid rate limits
    // Since search grounding is heavy, serial processing is safer for this demo.
    for (const item of queue) {
      if (stopProcessingRef.current) break;

      updateItem(item.id, { status: CheckStatus.PROCESSING });
      
      try {
        const result = await checkUsernameWithGemini(item.username);
        updateItem(item.id, {
          status: CheckStatus.COMPLETED,
          pageStatus: result.pageStatus,
          notes: result.notes,
          profileUrl: result.profileUrl
        });
      } catch (err) {
        updateItem(item.id, { status: CheckStatus.FAILED, notes: "API Error" });
      }

      // Small delay between requests to be polite
      await new Promise(r => setTimeout(r, 1000));
    }

    setIsProcessing(false);
  };

  const stopProcessing = () => {
    stopProcessingRef.current = true;
    setIsProcessing(false);
  };

  const exportExcel = () => {
    const dataToExport = usernames.map(u => ({
      Username: u.username,
      "Is Page Open?": u.pageStatus === PageStatus.OPEN ? "YES" : (u.pageStatus === PageStatus.CLOSED ? "NO" : "UNKNOWN"),
      "Availability": u.pageStatus === PageStatus.CLOSED ? "AVAILABLE" : (u.pageStatus === PageStatus.OPEN ? "TAKEN" : "UNKNOWN"),
      "Notes": u.notes || "",
      "Profile URL": u.profileUrl || ""
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, "instagram_check_results.xlsx");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 p-2 rounded-lg text-white">
              <Instagram className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                InstaCheck AI
              </h1>
              <p className="text-xs text-slate-500">Automated Username Availability & Page Status</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
             {/* API Key warning or indicator could go here */}
             <div className="text-xs text-slate-400 hidden md:block">
               Powered by Google Gemini 2.5
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Input Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2 flex items-center">
                <CheckSquare className="w-5 h-5 mr-2 text-blue-600"/> 
                Input Usernames
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Enter usernames manually or upload an Excel/CSV file to bulk check.
              </p>
              
              <textarea
                className="w-full h-40 p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-slate-50"
                placeholder="Enter usernames (one per line)...&#10;elonmusk&#10;taylorswift&#10;some_random_user_123"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button
                onClick={handleManualAdd}
                disabled={!inputText.trim()}
                className="mt-2 w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                Add to Queue
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Or upload file</span>
              </div>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-3 text-slate-400 group-hover:text-blue-500" />
                <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click to upload</span> CSV or Excel</p>
              </div>
              <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          {/* Controls & Stats Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
               <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Processing Queue</h2>
                    <p className="text-sm text-slate-500">
                      {usernames.length === 0 ? 'Queue is empty' : `${usernames.length} usernames loaded`}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {isProcessing ? (
                      <button onClick={stopProcessing} className="flex items-center px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors">
                        Stop
                      </button>
                    ) : (
                      <button 
                        onClick={startProcessing} 
                        disabled={usernames.length === 0}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200 transition-all hover:shadow-lg hover:shadow-blue-300"
                      >
                        <Play className="w-4 h-4 mr-2" /> Start Automation
                      </button>
                    )}
                    <button 
                      onClick={exportExcel} 
                      disabled={stats.processed === 0}
                      className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-200 transition-all hover:shadow-lg hover:shadow-emerald-300"
                    >
                      <Download className="w-4 h-4 mr-2" /> Export Excel
                    </button>
                    <button onClick={handleClear} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
               </div>

               {/* Stats Cards */}
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Processed</div>
                    <div className="text-2xl font-bold text-slate-800">{stats.processed} <span className="text-slate-400 text-lg">/ {stats.total}</span></div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="text-xs text-red-500 uppercase font-bold tracking-wider mb-1">Page Open (Yes)</div>
                    <div className="text-2xl font-bold text-red-700">{stats.open}</div>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="text-xs text-emerald-500 uppercase font-bold tracking-wider mb-1">Closed (No)</div>
                    <div className="text-2xl font-bold text-emerald-700">{stats.closed}</div>
                  </div>
                   <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="text-xs text-amber-500 uppercase font-bold tracking-wider mb-1">Errors</div>
                    <div className="text-2xl font-bold text-amber-700">{stats.errors}</div>
                  </div>
               </div>

               {/* Progress Bar */}
               <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden">
                 <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                 ></div>
               </div>
               <div className="flex justify-between text-xs text-slate-400">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
               </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Username</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Is Page Open?</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">AI Analysis</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {usernames.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                          <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p>No usernames in queue.</p>
                        </td>
                      </tr>
                    ) : (
                      usernames.slice().reverse().map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            @{user.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge checkStatus={user.status} pageStatus={user.pageStatus} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                            {user.pageStatus === PageStatus.OPEN ? 'YES' : (user.pageStatus === PageStatus.CLOSED ? 'NO' : '-')}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate" title={user.notes}>
                            {user.notes || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 text-blue-800 text-sm rounded-lg flex items-start">
               <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
               <div>
                 <strong>Note regarding accuracy:</strong> This tool uses AI Search Grounding to check for public profiles. It mimics a human searching for the profile. It is highly accurate for established public accounts but may not detect new, private, or banned accounts instantly. Always verify manually if unsure.
               </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}

export default App;