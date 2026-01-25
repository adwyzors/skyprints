'use client';

import { ArrowRight } from 'lucide-react';
import { Cinzel } from 'next/font/google';
import Link from 'next/link';

const cinzel = Cinzel({ subsets: ['latin'] });

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* BACKGROUND IMAGE WITH OVERLAY */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/bg-artistic.jpg')"
        }}
      >
        {/* Lighter overlay for white background image */}
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px]" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex flex-col items-center text-center p-6 space-y-10 animate-in fade-in zoom-in duration-1000">

        {/* LOGO / TITLE */}
        <div className="space-y-2">
          <h1 className={`${cinzel.className} text-6xl md:text-8xl font-bold text-gray-900 tracking-tight drop-shadow-sm`}>
            SkyPrints
          </h1>
          <div className="h-0.5 w-24 bg-gray-900 mx-auto rounded-full opacity-60" />
          <p className={`${cinzel.className} text-xl md:text-2xl text-gray-800 font-medium tracking-widest uppercase mt-4`}>
            The Art of Printing
          </p>
        </div>

        {/* ACTION BUTTON */}
        <Link
          href="/admin/orders"
          className="group relative inline-flex items-center gap-3 px-10 py-4 bg-gray-900 text-white rounded-none border border-gray-900 transition-all duration-300 hover:bg-transparent hover:text-gray-900 hover:shadow-xl"
        >
          <span className={`${cinzel.className} text-lg font-semibold tracking-wider`}>Enter Atelier</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>

      </div>

      {/* FOOTER */}
      <div className="absolute bottom-6 text-gray-600 text-xs font-medium tracking-widest uppercase z-10">
        © {new Date().getFullYear()} SkyPrints. Est. 2024
      </div>
    </main>
  );
}
