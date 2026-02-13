import { ProcessSummary } from '@/domain/model/process.model';
import { useDebounce } from '@/hooks/useDebounce';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { useEffect, useRef, useState } from 'react';

interface Props {
    processes: ProcessSummary[];
    selectedProcessId: string | null;
    onSelect: (processId: string) => void;
    disabled?: boolean;
    label?: string;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    allowClear?: boolean;
}

export default function SearchableProcessSelect({
    processes,
    selectedProcessId,
    onSelect,
    disabled,
    label = 'Process',
    placeholder = 'Search processes...',
    className = '',
    inputClassName = '',
    allowClear = true,
}: Props) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<'below' | 'above'>('below');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const debouncedSearch = useDebounce(search, 300);

    const selectedProcess = processes.find((p) => p.id === selectedProcessId);

    useEffect(() => {
        if (selectedProcess) {
            setSearch(selectedProcess.name);
        } else if (!isOpen) {
            setSearch('');
        }
    }, [selectedProcess, isOpen]);

    // Calculate dropdown position based on available space
    useEffect(() => {
        if (isOpen && inputRef.current) {
            const inputRect = inputRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - inputRect.bottom;
            const spaceAbove = inputRect.top;
            const dropdownHeight = 240; // max-h-60 = 240px

            // Open above if there's not enough space below but more space above
            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                setDropdownPosition('above');
            } else {
                setDropdownPosition('below');
            }
        }
    }, [isOpen]);

    useOnClickOutside(containerRef, () => setIsOpen(false));

    const filteredProcesses = processes.filter((p) =>
        p.name.toLowerCase().includes(debouncedSearch.toLowerCase().trim())
    ).slice(0, 50);

    const handleSelect = (process: ProcessSummary) => {
        onSelect(process.id);
        setSearch(process.name);
        setIsOpen(false);
    };

    const handleClear = () => {
        if (allowClear) {
            onSelect('');
            setSearch('');
        }
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        if (selectedProcessId && e.target.value !== selectedProcess?.name) {
                            handleClear();
                        }
                    }}
                    onFocus={() => setIsOpen(true)}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={inputClassName || "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"}
                />
                {selectedProcess && (
                    <div className="absolute right-3 top-3">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            ✓
                        </span>
                    </div>
                )}
                {isOpen && !selectedProcess && filteredProcesses.length > 0 && (
                    <div
                        className={`absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto ${dropdownPosition === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
                            }`}
                    >
                        {filteredProcesses.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => handleSelect(p)}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                            >
                                <div className="font-medium">{p.name}</div>
                                {p.description && (
                                    <div className="text-sm text-gray-500">{p.description}</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
