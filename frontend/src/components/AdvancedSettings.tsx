import React from "react";
import { Settings2, HelpCircle } from "lucide-react";

interface AdvancedSettingsProps {
  maxClicks: number;
  maxLoops: number;
  temperature: number;
  maxHallucinations: number;
  onConfigChange: (field: string, value: number) => void;
}

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  maxClicks,
  maxLoops,
  temperature,
  maxHallucinations,
  onConfigChange,
}) => {
  return (
    <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
        <Settings2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Advanced Parameters
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Max Clicks
            </label>
            <div className="group relative">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-10">
                Maximum number of steps allowed to reach the target page.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="50"
              value={maxClicks}
              onChange={(e) => onConfigChange("maxClicks", parseInt(e.target.value))}
              className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              min="5"
              max="50"
              value={maxClicks}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) {
                  onConfigChange("maxClicks", Math.min(50, Math.max(5, val)));
                }
              }}
              className="w-16 px-2 py-1 text-right text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Max Loops
            </label>
            <div className="group relative">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-10">
                Maximum number of times the model can visit the same page before
                failing (prevents infinite loops).
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="10"
              value={maxLoops}
              onChange={(e) => onConfigChange("maxLoops", parseInt(e.target.value))}
              className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              min="1"
              max="10"
              value={maxLoops}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) {
                  onConfigChange("maxLoops", Math.min(10, Math.max(1, val)));
                }
              }}
              className="w-16 px-2 py-1 text-right text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Temperature
            </label>
            <div className="group relative">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-10">
                Lower values make the model more deterministic, higher values
                make it more creative.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={temperature}
                onChange={(e) =>
                  onConfigChange("temperature", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between w-full text-[10px] text-slate-400 mt-1 absolute -bottom-4 px-1 pointer-events-none">
                <span>Precise (0.0)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={temperature}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                  onConfigChange("temperature", Math.min(1, Math.max(0, val)));
                }
              }}
              className="w-20 px-2 py-1 text-right text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Max Hallucinations
            </label>
            <div className="group relative">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-10">
                Maximum consecutive invalid links (hallucinations) allowed on a
                single page before failing.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="10"
              value={maxHallucinations}
              onChange={(e) =>
                onConfigChange("maxHallucinations", parseInt(e.target.value))
              }
              className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              min="1"
              max="10"
              value={maxHallucinations}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) {
                  onConfigChange(
                    "maxHallucinations",
                    Math.min(10, Math.max(1, val))
                  );
                }
              }}
              className="w-16 px-2 py-1 text-right text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AdvancedSettings);
