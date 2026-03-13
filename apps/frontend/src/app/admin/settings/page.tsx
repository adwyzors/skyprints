'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import { updatePreferences } from '@/services/auth.service';
import {
    CheckCircle2,
    Eye,
    Layout,
    RefreshCw,
    Save,
    ShieldCheck,
    Type
} from 'lucide-react';
import { useEffect, useState } from 'react';

function SettingsPage() {
    const { user, refresh } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Default preferences if none exist
    const initialPrefs = (user as any)?.user?.preferences || {};

    const [prefs, setPrefs] = useState({
        showRevenue: true,
        showOrders: true,
        showUnits: true,
        showHubs: true,
        showPulse: true,
        showChart: true,
        showPerformance: true,
        showProcesses: true,
        showCustomers: true,
        showWorkload: true,
        showMatrix: true,
        fontSize: 'base',
        ...initialPrefs
    });

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const handleToggle = (key: string) => {
        setPrefs((prev: any) => ({
            ...prev,
            [key]: !prev[key as keyof typeof prev]
        }));
        setHasChanges(true);
    };

    const handleFontSizeChange = (size: string) => {
        setPrefs((prev: any) => ({
            ...prev,
            fontSize: size
        }));
        setHasChanges(true);
        // LIVE PREVIEW: Apply font size class immediately to test
        document.documentElement.className = `font-${size}`;
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await updatePreferences(prefs);
            await refresh(); // Refresh user data in context
            setHasChanges(false);
            setMessage({ type: 'success', text: 'Preferences saved successfully!' });
        } catch (error) {
            console.error('Failed to save preferences:', error);
            setMessage({ type: 'error', text: 'Failed to save preferences. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    const sections = [
        {
            title: 'Dashboard Visibility',
            icon: <Layout className="w-6 h-6 text-blue-600" />,
            description: 'Choose which information modules you want to see when you first log in.',
            items: [
                { key: 'showRevenue', label: 'Revenue Stats', desc: 'Summary of billed revenue' },
                { key: 'showOrders', label: 'Order Counts', desc: 'Total finalized & billed orders' },
                { key: 'showUnits', label: 'Unit Totals', desc: 'Production output in pieces' },
                { key: 'showHubs', label: 'Active Hubs', desc: 'Hub ranking and share' },
                { key: 'showPulse', label: 'Live Pulse Cards', desc: 'Real-time production state counters' },
                { key: 'showChart', label: 'Revenue Dynamics', desc: 'Interactive revenue trend chart' },
                { key: 'showPerformance', label: 'Staff Utilization', desc: 'Manager productivity and volume' },
                { key: 'showProcesses', label: 'Process Share', desc: 'Revenue contribution by process' },
                { key: 'showCustomers', label: 'Customer Insights', desc: 'Top customer revenue share' },
                { key: 'showWorkload', label: 'Active Workload', desc: 'Unbilled production state' },
                { key: 'showMatrix', label: 'Lifecycle Matrix', desc: 'Workflow stage distribution' },
            ]
        }
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12 pb-32">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-gray-100">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                        System Preferences
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Account Settings</h1>
                    <p className="text-lg text-gray-500 font-medium max-w-2xl">Tailor your workspace experience by adjusting display settings and dashboard visibility to suit your workflow.</p>
                </div>

                <div className="flex items-center gap-4">
                    {hasChanges && (
                        <div className="hidden md:flex flex-col items-end mr-2 animate-in fade-in slide-in-from-right-2">
                            <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                Unsaved changes detected
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">Click save to persist your preferences</span>
                        </div>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !hasChanges}
                        className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black shadow-xl transition-all active:scale-95 ${!hasChanges
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                            : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300'
                            }`}
                    >
                        {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`p-5 rounded-2xl border-2 shadow-sm animate-in zoom-in-95 duration-300 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                    }`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${message.type === 'success' ? 'bg-emerald-200/50' : 'bg-red-200/50'}`}>
                            {message.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                        </div>
                        <div>
                            <span className="font-black text-sm block">Action {message.type === 'success' ? 'Successful' : 'Failed'}</span>
                            <span className="text-xs font-bold opacity-80">{message.text}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                <div className="lg:col-span-8 space-y-12">
                    {/* DISPLAY SETTINGS CARD */}
                    <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden group">
                        <div className="p-8 border-b border-gray-50 bg-linear-to-r from-blue-50/30 to-transparent flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-gray-100 text-blue-600">
                                <Type className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Display & Readability</h3>
                                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest text-[10px]">Customize how information is presented</p>
                            </div>
                        </div>
                        <div className="p-10 space-y-10">
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <label className="text-sm font-black text-gray-700 tracking-tight uppercase">Application Font Scaling</label>
                                    <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-tight">Live Preview Enabled</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    {[
                                        { id: 'sm', label: 'Small', desc: 'High Density', icon: 'A' },
                                        { id: 'base', label: 'Default', desc: 'Standard', icon: 'A' },
                                        { id: 'lg', label: 'Large', desc: 'High Visibility', icon: 'A' }
                                    ].map((size, idx) => (
                                        <button
                                            key={size.id}
                                            onClick={() => handleFontSizeChange(size.id)}
                                            className={`relative group p-6 rounded-3xl border-2 transition-all flex flex-col items-center text-center ${prefs.fontSize === size.id
                                                ? 'border-blue-600 bg-blue-50/30 shadow-lg shadow-blue-100'
                                                : 'border-gray-50 bg-gray-50/30 hover:border-gray-200 hover:bg-white'
                                                }`}
                                        >
                                            <div className={`mb-4 flex items-center justify-center font-black transition-transform group-hover:scale-110 ${prefs.fontSize === size.id ? 'text-blue-600' : 'text-gray-400'
                                                }`} style={{ fontSize: idx === 0 ? '14px' : idx === 1 ? '20px' : '28px' }}>
                                                {size.icon}
                                            </div>
                                            <p className={`text-lg font-black tracking-tight mb-1 ${prefs.fontSize === size.id ? 'text-blue-900' : 'text-gray-900'}`}>{size.label}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{size.desc}</p>
                                            {prefs.fontSize === size.id && (
                                                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-600" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-6 text-xs text-gray-400 font-medium italic">Scaling affects all dashboard cards, tables, and sidebars globally.</p>
                            </div>
                        </div>
                    </section>

                    {/* DASHBOARD VISIBILITY CARD */}
                    {sections.map((section, idx) => (
                        <section key={idx} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden">
                            <div className="p-8 border-b border-gray-50 bg-linear-to-r from-indigo-50/30 to-transparent flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-gray-100 text-indigo-600">
                                    {section.icon}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 tracking-tight">{section.title}</h3>
                                    <p className="text-sm text-gray-400 font-bold uppercase tracking-widest text-[10px]">{section.description}</p>
                                </div>
                            </div>
                            <div className="p-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {section.items.map(item => (
                                        <label key={item.key} className={`flex items-center justify-between p-5 rounded-3xl border transition-all cursor-pointer group ${prefs[item.key as keyof typeof prefs]
                                            ? 'border-blue-100 bg-white hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50'
                                            : 'border-gray-50 bg-gray-50/50 hover:bg-white hover:border-gray-200'
                                            }`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${prefs[item.key as keyof typeof prefs] ? 'bg-blue-600 text-white rotate-0' : 'bg-gray-200 text-gray-500 -rotate-6'
                                                    }`}>
                                                    <Eye className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-black text-gray-900 block group-hover:text-blue-700 transition-colors uppercase tracking-tight">{item.label}</span>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">{(item as any).desc}</span>
                                                </div>
                                            </div>
                                            <div className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={!!prefs[item.key as keyof typeof prefs]}
                                                    onChange={() => handleToggle(item.key)}
                                                />
                                                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </section>
                    ))}
                </div>

                <div className="lg:col-span-4 space-y-8 sticky top-8">
                    <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-blue-900/10 relative overflow-hidden">
                        {/* Decorative background element */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl" />

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-black tracking-tight">Important Note</h3>
                        </div>

                        <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-3xl mb-10">
                            <p className="text-sm text-blue-400 font-bold uppercase tracking-widest mb-4">Unsaved States</p>
                            <p className="text-sm text-gray-300 leading-relaxed font-semibold">Display adjustments (like font size) will show here <span className="text-white underline decoration-blue-500 decoration-2 underline-offset-4">live</span> as you change them, but they will revert once you navigate away unless you click <span className="text-blue-400">Save Settings</span> above.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between text-xs font-black text-gray-500 uppercase tracking-widest">
                                <span>Preview Analytics</span>
                                <span className="text-blue-500">Live</span>
                            </div>
                            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-linear-to-r from-blue-600 to-indigo-600 w-2/3" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="h-10 bg-gray-800 rounded-2xl border border-gray-700/50" />
                                <div className="h-10 bg-gray-800 rounded-2xl border border-gray-700/50" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-xl shadow-gray-100/50">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h4 className="text-xl font-black text-gray-900 mb-3 tracking-tight">Need Assistance?</h4>
                        <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">If these settings are not reflecting on your dashboard, try clearing your browser cache or contact support.</p>
                        <a
                            href="mailto:support@skyprint.com"
                            className="flex items-center justify-center w-full py-4 bg-gray-50 text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        >
                            Contact Support
                        </a>
                    </div>
                </div>
            </div>

            {/* Mobile Save Bar */}
            {hasChanges && (
                <div className="md:hidden fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom-10">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-3 py-5 bg-blue-600 text-white rounded-[2rem] font-black shadow-2xl shadow-blue-600/40 active:scale-95 transition-all"
                    >
                        {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Save All Changes
                    </button>
                </div>
            )}
        </div>
    );
}

export default withAuth(SettingsPage, {
    permission: Permission.SETTINGS_VIEW
});
