import React from 'react';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-0 md:p-6 overflow-x-hidden font-sans">
      <div className="w-full max-w-6xl h-full md:h-[680px] bg-slate-800 rounded-none md:rounded-2xl border-0 md:border border-slate-700/60 overflow-hidden flex flex-col md:flex-row shadow-2xl">
        
        {/* Left Column: Desktop Enterprise Showcase */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-slate-900 to-slate-950 p-10 flex-col justify-between border-r border-slate-700/40 relative">
          
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="text-emerald-500 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                width="24"
                height="24"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">AssetFlow</span>
          </div>

          {/* Core Content */}
          <div className="flex flex-col gap-8 my-auto text-left">
            <div>
              <h2 className="text-white text-3xl font-extrabold tracking-tight mb-3">Smart Resource Orchestration</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Optimize asset utilization, automate maintenance tracking, and empower operations across your enterprise from a unified control center.
              </p>
            </div>

            {/* ERP Dashboard Preview Widget */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 flex flex-col gap-4 backdrop-blur-md">
              <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>System Analytics</span>
                <span className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                  <span className="text-emerald-400 font-bold uppercase">Active</span>
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-3.5 text-left">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Assets</div>
                  <div className="text-white text-lg font-extrabold mt-1">1,482</div>
                  <div className="text-[10px] font-bold text-emerald-400 mt-0.5">
                    ↑ 12% this quarter
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-3.5 text-left">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Active Deployments</div>
                  <div className="text-white text-lg font-extrabold mt-1">94.2%</div>
                  <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                    942 operations live
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-3.5 text-left col-span-2">
                  <div className="flex justify-between items-center">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Resource Allocation Rate</div>
                    <div className="text-white text-sm font-extrabold">88%</div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[88%]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-slate-500 text-left">
            <span>© {new Date().getFullYear()} AssetFlow Technologies Inc. All rights reserved.</span>
          </div>
        </div>

        {/* Right Column: Form Panel */}
        <div className="w-full md:w-1/2 bg-slate-950 flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-md flex flex-col gap-6">
            
            {/* Mobile Header (Hidden on Desktop) */}
            <div className="flex md:hidden items-center gap-2.5 justify-center mb-6">
              <div className="text-emerald-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  width="26"
                  height="26"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <span className="font-extrabold text-xl text-white">AssetFlow</span>
            </div>

            {/* Injected Login or Signup Page Form Content */}
            {children}
            
          </div>
        </div>
        
      </div>
    </div>
  );
}
