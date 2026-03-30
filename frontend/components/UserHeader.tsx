// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { User } from "lucide-react";
import logo from "@/assets/hpe-logo.png";

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
              <div className="absolute right-0 mt-2 bg-white border rounded shadow-lg z-50 min-w-[120px]">
                <button
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
