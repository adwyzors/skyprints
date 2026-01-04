"use client";

export default function AppHeader() {
  return (
    <header className="flex items-center px-6 py-3 border-b bg-white">
      <div className="flex items-center gap-3">
        <img
          src="https://res.cloudinary.com/dr1wnqewh/image/upload/v1767274236/logo1_dqg9et.png"
          alt="Logo"
          className="h-9 w-9 object-contain"
        />
        <h1 className="text-lg font-semibold">
          Factory Process Manager
        </h1>
      </div>
    </header>
  );
}
