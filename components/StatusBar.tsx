import React from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface StatusBarProps {
  statusMessage: string;
  calculationSuccess: boolean;
  isDarkMode: boolean;
}

export default function StatusBar({
  statusMessage,
  calculationSuccess,
  isDarkMode,
}: StatusBarProps) {
  return (
    <div
      className={`${
        isDarkMode
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-gray-200"
      } border-t px-6 py-3 shadow-xl`}
    >
      <div className="flex items-center space-x-3">
        {calculationSuccess ? (
          <CheckCircle className="w-5 h-5 text-green-400" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-400" />
        )}
        <span
          className={`text-sm ${
            calculationSuccess
              ? isDarkMode
                ? "text-slate-300"
                : "text-gray-600"
              : isDarkMode
              ? "text-red-400"
              : "text-red-500"
          }`}
        >
          {statusMessage}
        </span>
      </div>
    </div>
  );
}