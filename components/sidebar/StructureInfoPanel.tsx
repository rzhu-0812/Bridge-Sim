import React from "react";
import { Info } from "lucide-react";
import { StructureInfo } from "@/lib/types";

interface StructureInfoPanelProps {
  structureInfo: StructureInfo;
  isDarkMode: boolean;
}

export default function StructureInfoPanel({
  structureInfo,
  isDarkMode,
}: StructureInfoPanelProps) {
  const items = [
    {
      label: "Joints",
      value: structureInfo.joints,
      colorClass: isDarkMode ? "text-blue-400" : "text-blue-600",
    },
    {
      label: "Beams",
      value: structureInfo.beams,
      colorClass: isDarkMode ? "text-purple-400" : "text-purple-600",
    },
    {
      label: "Anchors",
      value: structureInfo.anchors,
      colorClass: isDarkMode ? "text-green-400" : "text-green-600",
    },
    {
      label: "Loads",
      value: structureInfo.loads,
      colorClass: isDarkMode ? "text-amber-400" : "text-amber-600",
    },
  ];

  return (
    <div
      className={`${
        isDarkMode
          ? "bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600"
          : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
      } rounded-xl p-4 border`}
    >
      <div className="flex items-center space-x-2 mb-4">
        <Info
          className={`w-5 h-5 ${
            isDarkMode ? "text-blue-400" : "text-blue-600"
          }`}
        />
        <h2
          className={`text-lg font-semibold ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}
        >
          Structure Info
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className={`${
              isDarkMode ? "bg-slate-900/50" : "bg-white/50"
            } rounded-lg p-3`}
          >
            <div
              className={`text-xs ${
                isDarkMode ? "text-slate-400" : "text-gray-500"
              }`}
            >
              {item.label}
            </div>
            <div className={`text-xl font-bold ${item.colorClass}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
