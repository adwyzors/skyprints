import { Customer } from '@/domain/model/customer.model';
import { useDebounce } from '@/hooks/useDebounce';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
    customers: Customer[];
    selectedCustomerId: string | null;
    onSelect: (customer: Customer | null) => void;
    disabled?: boolean;
}

export default function CustomerSelector({ customers, selectedCustomerId, onSelect, disabled }: Props) {
    // Local state for search inputs
    const [nameSearch, setNameSearch] = useState('');
    const [codeSearch, setCodeSearch] = useState('');

    // Dropdown visibility
    const [showNameList, setShowNameList] = useState(false);
    const [showCodeList, setShowCodeList] = useState(false);
    const [nameDropdownPosition, setNameDropdownPosition] = useState<'below' | 'above'>('below');
    const [codeDropdownPosition, setCodeDropdownPosition] = useState<'below' | 'above'>('below');

    // Refs for click outside and position calculation
    const nameContainerRef = useRef<HTMLDivElement>(null);
    const codeContainerRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const codeInputRef = useRef<HTMLInputElement>(null);

    // Debounced search terms for filtering
    const debouncedNameSearch = useDebounce(nameSearch, 300);
    const debouncedCodeSearch = useDebounce(codeSearch, 300);

    // Sync internal state when external selection changes
    const selectedCustomer = useMemo(
        () => customers.find((c) => c.id === selectedCustomerId),
        [customers, selectedCustomerId]
    );

    useEffect(() => {
        if (selectedCustomer) {
            setNameSearch(selectedCustomer.name);
            setCodeSearch(selectedCustomer.code || '');
        } else {
            // Typically we don't clear inputs if user is just typing and hasn't selected yet,
            // but if selection is explicitly cleared from outside, we might want to sync.
            // However, for this use case, on local typing we manually clear selection in parent,
            // so we rely on handleNameChange/handleCodeChange for local state logic.
        }
    }, [selectedCustomer]);

    // Click outside handlers
    useOnClickOutside(nameContainerRef, () => setShowNameList(false));
    useOnClickOutside(codeContainerRef, () => setShowCodeList(false));

    // Calculate dropdown positions based on available space
    useEffect(() => {
        if (showNameList && nameInputRef.current) {
            const inputRect = nameInputRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - inputRect.bottom;
            const spaceAbove = inputRect.top;
            const dropdownHeight = 240; // max-h-60 = 240px

            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                setNameDropdownPosition('above');
            } else {
                setNameDropdownPosition('below');
            }
        }
    }, [showNameList]);

    useEffect(() => {
        if (showCodeList && codeInputRef.current) {
            const inputRect = codeInputRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - inputRect.bottom;
            const spaceAbove = inputRect.top;
            const dropdownHeight = 240; // max-h-60 = 240px

            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                setCodeDropdownPosition('above');
            } else {
                setCodeDropdownPosition('below');
            }
        }
    }, [showCodeList]);

    // DERIVED: Suggestions
    const nameSuggestions = useMemo(() => {
        const s = debouncedNameSearch.toLowerCase().trim();
        if (!s) return showNameList ? customers : [];
        // Limit to 50 for performance
        return customers
            .filter((c) => c.name.toLowerCase().includes(s) || c.code?.toLowerCase().includes(s))
            .slice(0, 50);
    }, [debouncedNameSearch, customers, showNameList]);

    const codeSuggestions = useMemo(() => {
        const s = debouncedCodeSearch.toLowerCase().trim();
        if (!s) return showCodeList ? customers : [];
        return customers
            .filter((c) => c.code?.toLowerCase().includes(s) || c.name.toLowerCase().includes(s))
            .slice(0, 50);
    }, [debouncedCodeSearch, customers, showCodeList]);

    // HANDLERS
    const handleSelect = (customer: Customer) => {
        onSelect(customer);
        setNameSearch(customer.name);
        setCodeSearch(customer.code || '');
        setShowNameList(false);
        setShowCodeList(false);
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNameSearch(val);
        if (selectedCustomerId) {
            onSelect(null);
            setCodeSearch('');
        }
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCodeSearch(val);
        if (selectedCustomerId) {
            onSelect(null);
            setNameSearch('');
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* NAME SEARCH */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Customer</label>
                <div className="relative" ref={nameContainerRef}>
                    <input
                        ref={nameInputRef}
                        type="text"
                        placeholder="Search by name..."
                        value={nameSearch}
                        onChange={handleNameChange}
                        onFocus={() => setShowNameList(true)}
                        disabled={disabled}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                    />
                    {selectedCustomer && (
                        <div className="absolute right-3 top-3">
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                ✓
                            </span>
                        </div>
                    )}
                    {showNameList && !selectedCustomer && nameSuggestions.length > 0 && (
                        <div
                            className={`absolute z-60 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto ${nameDropdownPosition === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
                                }`}
                        >
                            {nameSuggestions.map((c) => (
                                <div
                                    key={c.id}
                                    onClick={() => handleSelect(c)}
                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                                >
                                    <div className="font-medium">{c.name}</div>
                                    <div className="text-sm text-gray-500">Code: {c.code}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* CODE SEARCH */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Customer Code</label>
                <div className="relative" ref={codeContainerRef}>
                    <input
                        ref={codeInputRef}
                        type="text"
                        placeholder="Search by code..."
                        value={codeSearch}
                        onChange={handleCodeChange}
                        onFocus={() => setShowCodeList(true)}
                        disabled={disabled}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                    />
                    {selectedCustomer && (
                        <div className="absolute right-3 top-3">
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                ✓
                            </span>
                        </div>
                    )}
                    {showCodeList && !selectedCustomer && codeSuggestions.length > 0 && (
                        <div
                            className={`absolute z-60 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto ${codeDropdownPosition === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'
                                }`}
                        >
                            {codeSuggestions.map((c) => (
                                <div
                                    key={c.id}
                                    onClick={() => handleSelect(c)}
                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                                >
                                    <div className="font-medium text-blue-700">{c.code}</div>
                                    <div className="text-sm text-gray-500">{c.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
