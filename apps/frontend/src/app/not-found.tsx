'use client';

import { ArrowLeft, Home, MoveRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600" />
            <div className="absolute top-40 right-1/4 w-72 h-72 bg-blue-100/50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse" />
            <div className="absolute bottom-40 left-1/4 w-72 h-72 bg-indigo-100/50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse delay-1000" />

            <div className="relative z-10 w-full max-w-2xl">
                <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-blue-900/10 border border-white p-10 md:p-16 text-center overflow-hidden">
                    {/* Floating 404 Illustration */}
                    <div className="relative mb-12">
                        <div className="text-[10rem] md:text-[14rem] font-black text-gray-50 leading-none select-none">
                            404
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-100 rounded-3xl -rotate-12 scale-110" />
                                <div className="relative w-24 h-24 bg-white rounded-3xl border-2 border-blue-50 flex items-center justify-center shadow-xl transform hover:rotate-6 transition-all duration-500">
                                    <Search size={48} className="text-blue-600 animate-bounce" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 mb-12 relative">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">
                            Lost in Space?
                        </h1>
                        <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto leading-relaxed">
                            The page you're looking for seems to have vanished into thin air. Let's get you back on track.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button
                            onClick={() => router.back()}
                            className="group flex items-center gap-3 px-8 py-4 bg-white text-gray-700 font-bold rounded-2xl border-2 border-gray-100 hover:border-blue-200 hover:text-blue-600 transition-all duration-300 shadow-lg shadow-gray-100 hover:shadow-blue-50"
                        >
                            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                            Go Back
                        </button>
                        <Link
                            href="/"
                            className="group flex items-center gap-3 px-10 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all duration-300 shadow-xl shadow-gray-200"
                        >
                            <Home size={20} />
                            Return Home
                            <MoveRight size={18} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </Link>
                    </div>

                    <div className="mt-16 pt-8 border-t border-gray-50 flex flex-wrap justify-center gap-6">
                        <div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-400">
                            Error Code: <span className="text-gray-900">PATH_NOT_FOUND</span>
                        </div>
                        <div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-400">
                            System: <span className="text-gray-900">SkyPrints_UI</span>
                        </div>
                    </div>
                </div>

                <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 px-4 overflow-hidden">
                    {[
                        { label: 'Dashboard', href: '/admin/dashboard' },
                        { label: 'Orders', href: '/admin/orders' },
                        { label: 'Customers', href: '/admin/customers' },
                        { label: 'Help Center', href: '#' },
                    ].map((item, i) => (
                        <Link
                            key={i}
                            href={item.href}
                            className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white hover:bg-white transition-all text-center"
                        >
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Quick Link</span>
                            <span className="text-sm font-bold text-gray-800">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
