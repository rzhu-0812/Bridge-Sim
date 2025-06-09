import React from "react";
import { Search, ZoomIn, ZoomOut, ExpandIcon } from "lucide-react";

interface ViewControlsPanelProps {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  zoomLevel: number;
  isDarkMode: boolean;
}

export default function ViewControlsPanel({
  zoomIn,
  zoomOut,
  resetView,
  zoomLevel,
  isDarkMode,
}: ViewControlsPanelProps) {
  return (
    <div
      className={`${
        isDarkMode
          ? "bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600"
          : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
      } rounded-xl p-4 border`}
    >
      <div className="flex items-center space-x-2 mb-4">
        <Search
          className={`w-5 h-5 ${
            isDarkMode ? "text-purple-400" : "text-purple-600"
          }`}
        />
        <h2
          className={`text-lg font-semibold ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}
        >
          View Controls
        </h2>
      </div>

      <div className="space-y-3">
        <div className="flex space-x-2">
          <button
            onClick={zoomIn}
            className={`flex-1 flex items-center justify-center space-x-2 ${
              isDarkMode
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-800"
            } py-2 px-3 rounded-lg text-sm transition-colors`}
          >
            <ZoomIn className="w-4 h-4" />
            <span>Zoom In</span>
          </button>
          <button
            onClick={zoomOut}
            className={`flex-1 flex items-center justify-center space-x-2 ${
              isDarkMode
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-800"
            } py-2 px-3 rounded-lg text-sm transition-colors`}
          >
            <ZoomOut className="w-4 h-4" />
            <span>Zoom Out</span>
          </button>
        </div>

        <button
          onClick={resetView}
          className={`w-full flex items-center justify-center space-x-2 ${
            isDarkMode
              ? "bg-slate-700 hover:bg-slate-600 text-white"
              : "bg-gray-200 hover:bg-gray-300 text-gray-800"
          } py-2 px-3 rounded-lg text-sm transition-colors`}
        >
          <ExpandIcon className="w-4 h-4" />
          <span>Reset View</span>
        </button>

        <div
          className={`text-sm ${
            isDarkMode ? "text-slate-400" : "text-gray-500"
          }`}
        >
          Zoom:{" "}
          <span
            className={`font-mono ${
              isDarkMode ? "text-purple-400" : "text-purple-600"
            }`}
          >
            {zoomLevel}%
          </span>
        </div>
      </div>
    </div>
  );
}
