import React from "react";
import { Eye } from "lucide-react";
import { DisplayOptions } from "@/lib/types";

interface DisplayOptionsPanelProps {
  displayOptions: DisplayOptions;
  setDisplayOptions: (options: DisplayOptions) => void;
  isDarkMode: boolean;
}

export default function DisplayOptionsPanel({
  displayOptions,
  setDisplayOptions,
  isDarkMode,
}: DisplayOptionsPanelProps) {
  const optionsConfig = [
    { key: "grid", label: "Show Grid" },
    { key: "forces", label: "Color Beams by Force" },
    { key: "reactions", label: "Show Reaction Forces" },
  ] as const;

  return (
    <div
      className={`${
        isDarkMode
          ? "bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600"
          : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
      } rounded-xl p-4 border`}
    >
      <div className="flex items-center space-x-2 mb-4">
        <Eye
          className={`w-5 h-5 ${
            isDarkMode ? "text-green-400" : "text-green-600"
          }`}
        />
        <h2
          className={`text-lg font-semibold ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}
        >
          Display Options
        </h2>
      </div>

      <div className="space-y-3">
        {optionsConfig.map((option) => (
          <label
            key={option.key}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={displayOptions[option.key]}
              onChange={(e) => {
                setDisplayOptions({
                  ...displayOptions,
                  [option.key]: e.target.checked,
                });
              }}
              className={`w-4 h-4 text-blue-500 ${
                isDarkMode
                  ? "bg-slate-700 border-slate-600"
                  : "bg-white border-gray-300"
              } rounded focus:ring-blue-500 focus:ring-2`}
            />
            <span
              className={`text-sm ${
                isDarkMode
                  ? "text-slate-300 group-hover:text-white"
                  : "text-gray-600 group-hover:text-gray-800"
              } transition-colors`}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
