'use client';
import { logout } from '@/auth/authClient';
// apps\frontend\src\components\layout\AppHeader.tsx
import { ChevronDown, LogOut, Menu, Settings, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function AppHeader() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Set mounted state after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isMounted) return;

    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMounted]);

const handleLogout = async () => {
  try {
    await logout();
  } finally {
    setShowProfileMenu(false);
  }
};

  const handleViewProfile = () => {
    // Add view profile logic here
    console.log('Viewing profile...');
    setShowProfileMenu(false);
  };

  // Don't render interactive buttons during SSR
  if (!isMounted) {
    return (
      <header className="sticky top-0 z-50 bg-linear-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Static version without interactive elements */}
            <div className="flex items-center gap-4">
              <div className="lg:hidden p-2 rounded-lg">
                <Menu className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src="https://res.cloudinary.com/dr1wnqewh/image/upload/v1767274236/logo1_dqg9et.png"
                    alt="Sky Prints Logo"
                    className="h-10 w-10 object-contain drop-shadow-sm"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-linear-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    Sky Prints
                  </h1>
                  <p className="text-xs text-gray-500 font-medium">Factory Process Manager</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex items-center gap-2 pl-3 pr-2 py-2">
                  <div className="relative">
                    <div className="w-9 h-9 bg-linear-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      SP
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-sm font-semibold text-gray-800">Admin User</p>
                    <p className="text-xs text-gray-500">Production Manager</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-linear-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* LEFT SECTION - LOGO & BRAND */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-700" />
              ) : (
                <Menu className="w-5 h-5 text-gray-700" />
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="https://res.cloudinary.com/dr1wnqewh/image/upload/v1767274236/logo1_dqg9et.png"
                  alt="Sky Prints Logo"
                  className="h-10 w-10 object-contain drop-shadow-sm"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-linear-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  Sky Prints
                </h1>
                <p className="text-xs text-gray-500 font-medium">Factory Process Manager</p>
              </div>
            </div>
          </div>

          {/* MOBILE MENU OVERLAY */}
          {isMobileMenuOpen && (
            <div className="absolute top-16 left-0 right-0 bg-white border-t border-gray-200 shadow-lg lg:hidden">
              <div className="px-4 py-3 space-y-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </button>
                <div className="border-t pt-3">
                  <button
                    onClick={handleViewProfile}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <User className="w-5 h-5" />
                    <span>View Profile</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RIGHT SECTION - ICONS & PROFILE */}
          <div className="flex items-center gap-3">
            {/* PROFILE DROPDOWN */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div className="relative">
                  <div className="w-9 h-9 bg-linear-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    SP
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-semibold text-gray-800">Admin User</p>
                  <p className="text-xs text-gray-500">Production Manager</p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {/* PROFILE DROPDOWN MENU */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-lg py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-semibold text-gray-800">Admin User</p>
                    <p className="text-sm text-gray-500">admin@skyprints.com</p>
                    <p className="text-xs text-gray-400 mt-1">Production Manager</p>
                  </div>

                  <div className="py-2">
                    <button
                      onClick={handleViewProfile}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>View Profile</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-4 h-4" />
                      <span>Account Settings</span>
                    </button>
                  </div>

                  <div className="border-t border-gray-100 pt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
