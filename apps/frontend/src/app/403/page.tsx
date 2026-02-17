'use client';

import { ArrowLeft, Home, Lock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotAuthorized() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
            <div className="absolute top-20 left-1/4 w-64 h-64 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
            <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-700" />

            <div className="relative z-10 w-full max-w-lg">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-blue-900/5 border border-white p-8 md:p-12 text-center">
                    <div className="flex justify-center mb-8">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-100 rounded-2xl rotate-6 mt-1 ml-1" />
                            <div className="relative w-20 h-20 bg-white rounded-2xl border-2 border-red-50 flex items-center justify-center shadow-lg transform transition-transform hover:scale-110 duration-300">
                                <ShieldAlert size={40} className="text-red-500" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-gray-900 text-white p-1.5 rounded-lg shadow-lg">
                                <Lock size={16} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 mb-10">
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                            Access Denied
                        </h1>
                        <div className="h-1 w-20 bg-red-500 mx-auto rounded-full" />
                        <p className="text-gray-500 text-lg leading-relaxed max-w-sm mx-auto">
                            You don't have the necessary permissions to access this secure zone.
                            Please contact your administrator if you believe this is a mistake.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-gray-700 font-bold rounded-2xl border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all duration-300"
                        >
                            <ArrowLeft size={18} />
                            Go Back
                        </button>
                        <Link
                            href="/"
                            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all duration-300 shadow-xl shadow-gray-200"
                        >
                            <Home size={18} />
                            Home Dashboard
                        </Link>
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-100">
                        <div className="flex items-center justify-center gap-3 text-gray-400">
                            <span className="text-xs font-mono uppercase tracking-widest px-2 py-1 bg-gray-50 rounded border border-gray-100">
                                403 Forbidden
                            </span>
                            <span className="text-xs">•</span>
                            <span className="text-xs font-mono uppercase tracking-widest px-2 py-1 bg-gray-50 rounded border border-gray-100">
                                Protected Route
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-gray-400 text-sm">
                        Logged in as <span className="text-gray-600 font-semibold">Authorized Personnel Only</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
