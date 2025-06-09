"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Circle,
  Minus,
  Anchor,
  Download,
  Undo,
  RotateCcw,
  Sun,
  Moon,
  MousePointer,
  DraftingCompass,
  Trash2,
  ChevronDown,
} from "lucide-react";
import type { Tool } from "@/lib/types";

interface HeaderProps {
  currentTool: Tool;
  setCurrentTool: (tool: Tool) => void;
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
  undoAction: () => void;
  resetStructure: () => void;
  deleteSelected: () => void;
  selectedElementForDelete: { type: "joint" | "beam"; id: number } | null;
}

const toolsConfig: {
  id: Tool;
  icon: React.ElementType;
  label: string;
  shortcut: string;
}[] = [
  { id: "joint", icon: Circle, label: "Joint", shortcut: "J" },
  { id: "beam", icon: Minus, label: "Beam", shortcut: "B" },
  { id: "anchor", icon: Anchor, label: "Anchor", shortcut: "A" },
  { id: "load", icon: Download, label: "Load", shortcut: "L" },
  { id: "select", icon: MousePointer, label: "Select", shortcut: "S" },
];

export default function Header({
  currentTool,
  setCurrentTool,
  isDarkMode,
  setIsDarkMode,
  undoAction,
  resetStructure,
  deleteSelected,
  selectedElementForDelete,
}: HeaderProps) {
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedToolConfig =
    toolsConfig.find((t) => t.id === currentTool) || toolsConfig[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsToolsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <header
      className={`${
        isDarkMode
          ? "bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600"
          : "bg-gradient-to-r from-white to-gray-50 border-gray-200"
      } border-b shadow-xl`}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <DraftingCompass
                  className={`w-8 h-8 ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`}
                />
                <div
                  className={`absolute inset-0 ${
                    isDarkMode ? "bg-blue-400" : "bg-blue-600"
                  } rounded-full blur-lg opacity-20 -z-10`}
                ></div>
              </div>
              <div>
                <h1
                  className={`text-2xl font-bold bg-gradient-to-r ${
                    isDarkMode
                      ? "from-blue-400 to-purple-400"
                      : "from-blue-600 to-purple-600"
                  } bg-clip-text text-transparent`}
                >
                  BridgeSim
                </h1>
                <p
                  className={`text-xs ${
                    isDarkMode ? "text-slate-400" : "text-gray-500"
                  }`}
                >
                  Structural Simulator
                </p>
              </div>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsToolsDropdownOpen(!isToolsDropdownOpen)}
                className={`
                  group flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm
                  transition-all duration-200 ease-out
                  ${
                    isDarkMode
                      ? "bg-slate-700 hover:bg-slate-600 text-white"
                      : "bg-white hover:bg-gray-50 text-gray-800 border border-gray-200"
                  }
                  shadow-md
                `}
                title={`Current Tool: ${selectedToolConfig.label} (${selectedToolConfig.shortcut})`}
              >
                <selectedToolConfig.icon
                  className={`w-4 h-4 ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`}
                />
                <span>{selectedToolConfig.label}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isToolsDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isToolsDropdownOpen && (
                <div
                  className={`absolute mt-1 w-48 rounded-lg shadow-lg py-1 z-50
                  ${
                    isDarkMode
                      ? "bg-slate-800 border border-slate-700"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  {toolsConfig.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = currentTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setCurrentTool(tool.id);
                          setIsToolsDropdownOpen(false);
                        }}
                        className={`
                          w-full flex items-center justify-between px-4 py-2 text-sm
                          ${
                            isActive
                              ? isDarkMode
                                ? "bg-slate-700 text-blue-400"
                                : "bg-gray-100 text-blue-600"
                              : isDarkMode
                              ? "text-slate-300 hover:bg-slate-700 hover:text-white"
                              : "text-gray-700 hover:bg-gray-50"
                          }
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon
                            className={`w-4 h-4 ${
                              isActive
                                ? isDarkMode
                                  ? "text-blue-400"
                                  : "text-blue-600"
                                : isDarkMode
                                ? "text-slate-400"
                                : "text-gray-500"
                            }`}
                          />
                          <span>{tool.label}</span>
                        </div>
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-slate-500" : "text-gray-400"
                          }`}
                        >
                          {tool.shortcut}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {selectedElementForDelete && (
              <button
                onClick={deleteSelected}
                className="flex items-center space-x-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-all duration-200"
                title="Delete Selected Element"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                isDarkMode
                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                  : "bg-slate-700 hover:bg-slate-800 text-white"
              }`}
              title={
                isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
              <span>{isDarkMode ? "Light" : "Dark"}</span>
            </button>

            <button
              onClick={undoAction}
              className="flex items-center space-x-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-all duration-200"
              title="Undo Last Action (U)"
            >
              <Undo className="w-4 h-4" />
              <span>Undo</span>
            </button>

            <button
              onClick={resetStructure}
              className="flex items-center space-x-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-all duration-200"
              title="Reset Structure (R)"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}