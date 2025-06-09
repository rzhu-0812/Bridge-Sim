import React from "react";
import { Sliders } from "lucide-react";
import { LoadValues } from "@/lib/types";
import { LOAD_INCREMENT_STEP } from "@/lib/constants";

interface LoadPanelProps {
  selectedLoadJoint: number | null;
  loadValues: LoadValues;
  onModifyLoad: (axis: "fx" | "fy", direction: "plus" | "minus") => void;
  onClearLoad: () => void;
  isDarkMode: boolean;
}

export default function LoadPanel({
  selectedLoadJoint,
  loadValues,
  onModifyLoad,
  onClearLoad,
  isDarkMode,
}: LoadPanelProps) {
  if (selectedLoadJoint === null) return null;

  return (
    <div
      className={`${
        isDarkMode
          ? "bg-gradient-to-br from-amber-900/20 to-orange-900/20 border-amber-500/30"
          : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
      } rounded-xl p-4 border`}
    >
      <div className="flex items-center space-x-2 mb-4">
        <Sliders
          className={`w-5 h-5 ${
            isDarkMode ? "text-amber-400" : "text-amber-600"
          }`}
        />
        <h2
          className={`text-lg font-semibold ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}
        >
          Modify Load: Joint {selectedLoadJoint}
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label
              className={`text-sm font-medium ${
                isDarkMode ? "text-slate-300" : "text-gray-700"
              }`}
            >
              Force X (Fx)
            </label>
            <span
              className={`text-sm font-mono ${
                isDarkMode ? "text-amber-400" : "text-amber-600"
              }`}
            >
              {loadValues.fx.toFixed(0)} N
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onModifyLoad("fx", "minus")}
              className={`flex-1 ${
                isDarkMode
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
              } py-2 px-3 rounded-lg text-sm transition-colors`}
            >
              -{LOAD_INCREMENT_STEP}
            </button>
            <button
              onClick={() => onModifyLoad("fx", "plus")}
              className={`flex-1 ${
                isDarkMode
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
              } py-2 px-3 rounded-lg text-sm transition-colors`}
            >
              +{LOAD_INCREMENT_STEP}
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label
              className={`text-sm font-medium ${
                isDarkMode ? "text-slate-300" : "text-gray-700"
              }`}
            >
              Force Y (Fy)
            </label>
            <span
              className={`text-sm font-mono ${
                isDarkMode ? "text-amber-400" : "text-amber-600"
              }`}
            >
              {loadValues.fy.toFixed(0)} N
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onModifyLoad("fy", "minus")}
              className={`flex-1 ${
                isDarkMode
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
              } py-2 px-3 rounded-lg text-sm transition-colors`}
            >
              -{LOAD_INCREMENT_STEP}
            </button>
            <button
              onClick={() => onModifyLoad("fy", "plus")}
              className={`flex-1 ${
                isDarkMode
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
              } py-2 px-3 rounded-lg text-sm transition-colors`}
            >
              +{LOAD_INCREMENT_STEP}
            </button>
          </div>
        </div>

        <button
          onClick={onClearLoad}
          className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm transition-colors"
        >
          Clear Load
        </button>
      </div>
    </div>
  );
}
