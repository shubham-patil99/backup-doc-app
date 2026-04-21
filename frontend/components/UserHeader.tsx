// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { User } from "lucide-react";
import logo from "@/assets/hpe-logo.png";
import { color } from "jodit/esm/plugins/color/color";

export default function UserHeader({ username }) {
  const [hydrated, setHydrated] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleLogout = () => {
  // Clear all localStorage/sessionStorage
  localStorage.clear();
  sessionStorage.clear();
  // Optionally, call your backend logout API here
  // Redirect to login page
  window.location.href = "/auth/login";
};

  return (
    <div className="bg-gray-900 shadow-sm border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          <img src={logo.src} alt="HPE Logo" width={70} height={70} />
          <span className="text-xl font-bold text-white">Brahma</span>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-gray-700 text-gray-200 text-sm rounded-full">
            {hydrated ? username : ""}
          </span>
          <div className="relative">
            <div
              className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer"
              onClick={() => setShowLogout(prev => !prev)}
              title="User menu"
            >
              <User className="text-white" size={16} />
            </div>
            {showLogout && (
              <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px] overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 text-gray-700 hover:bg-red-50 border-b border-gray-100 cursor-pointer font-medium text-sm"
                  onClick={handleLogout}
                  style={{color: 'red', fontWeight: 'bold'}}
                >
                  Logout
                </button>
                <div className="px-4 py-1 bg-gray-50 border-t border-gray-100">
                  <p className="text-[12px] text-gray-800 font-semibold">brahma_2026.04_IT4</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
