import { useDebounce } from '@/hooks/useDebounce';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { User } from '@/services/user.service';
import { useEffect, useRef, useState } from 'react';

interface Props {
    users: User[];
    selectedUserId: string | null;
    onSelect: (userId: string) => void;
    disabled?: boolean;
    label?: string;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    allowClear?: boolean;
}

export default function SearchableManagerSelect({
    users,
    selectedUserId,
    onSelect,
    disabled = false,
    label,
    placeholder = 'Select user...',
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

    const selectedUser = users.find((u) => u.id === selectedUserId);

    useEffect(() => {
        if (selectedUser) {
            setSearch(selectedUser.name);
        } else if (!isOpen) {
            setSearch('');
        }
    }, [selectedUser, isOpen]);

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

    const filteredUsers = users.filter((u) =>
        u.name.toLowerCase().includes(debouncedSearch.toLowerCase().trim())
    ).slice(0, 50);

    const handleSelect = (user: User) => {
        onSelect(user.id);
        setSearch(user.name);
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
                        if (selectedUserId && e.target.value !== selectedUser?.name) {
                            handleClear();
                        }
                    }}
                    onFocus={() => setIsOpen(true)}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={inputClassName || "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"}
                />
                {selectedUser && (
                    <div className="absolute right-3 top-3">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            ✓
                        </span>
                    </div>
                )}
                {isOpen && !selectedUser && filteredUsers.length > 0 && (
                    <div
                        className={`absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto ${dropdownPosition === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
                            }`}
                    >
                        {filteredUsers.map((u) => (
                            <div
                                key={u.id}
                                onClick={() => handleSelect(u)}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                            >
                                <div className="font-medium">{u.name}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
