import { Location } from '@/domain/model/location.model';
import { useEffect, useState } from 'react';

interface SearchableLocationSelectProps {
  label: string;
  valueId?: string;
  onChange: (id: string) => void;
  locations: Location[];
  placeholder?: string;
  className?: string;
}

export default function SearchableLocationSelect({
  label,
  valueId,
  onChange,
  locations,
  placeholder,
  className
}: SearchableLocationSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Initialize search with current selected location name if any
  useEffect(() => {
    if (valueId) {
      const l = locations.find((l) => l.id === valueId);
      if (l) setSearch(l.name);
    } else {
      setSearch('');
    }
  }, [valueId, locations]);

  const filtered = locations.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${className || ''}`}>
      <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
      <input
        type="text"
        value={search}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          // If clear, clear selection
          if (e.target.value === '') onChange('');
        }}
        onBlur={() => {
          // Delay hide to allow click
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder={placeholder || `Search ${label}...`}
        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded shadow-lg max-h-40 overflow-y-auto">
          {filtered.map((l) => (
            <div
              key={l.id}
              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer text-gray-700"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                onChange(l.id);
                setSearch(l.name);
                setIsOpen(false);
              }}
            >
              <div className="font-semibold">{l.code}</div>
              <div className="text-xs text-gray-500">{l.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
