'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import { updatePreferences } from '@/services/auth.service';
import {
    CheckCircle2,
    Eye,
    Layout,
    Monitor,
    RefreshCw,
    Save,
    ShieldCheck,
    Type
} from 'lucide-react';
import { useEffect, useState } from 'react';

function SettingsPage() {
    const { user, refresh } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
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
    };

    const handleFontSizeChange = (size: string) => {
        setPrefs((prev: any) => ({
            ...prev,
            fontSize: size
        }));
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await updatePreferences(prefs);
            await refresh(); // Refresh user data in context
            setMessage({ type: 'success', text: 'Preferences saved successfully!' });
            // Apply font size change immediately by adding class to html
            document.documentElement.className = `font-${prefs.fontSize}`;
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
            icon: <Layout className="w-5 h-5 text-blue-600" />,
            description: 'Control which sections are visible on your admin dashboard.',
            items: [
                { key: 'showRevenue', label: 'Revenue Stats' },
                { key: 'showOrders', label: 'Order Counts' },
                { key: 'showUnits', label: 'Unit Totals' },
                { key: 'showHubs', label: 'Active Hubs' },
                { key: 'showPulse', label: 'Live Pulse Cards' },
                { key: 'showChart', label: 'Revenue Dynamics Chart' },
                { key: 'showPerformance', label: 'Manager Performance' },
                { key: 'showProcesses', label: 'Top Processes' },
                { key: 'showCustomers', label: 'Top Customers' },
                { key: 'showWorkload', label: 'Active Workload' },
                { key: 'showMatrix', label: 'Workflow Lifecycle Matrix' },
            ]
        }
    ];

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Account Settings</h1>
                    <p className="text-sm text-gray-500">Manage your interface preferences and display settings</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
                >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                    }`}>
                    <div className="flex items-center gap-3">
                        {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                        <span className="font-semibold text-sm">{message.text}</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                    {/* UI Preferences */}
                    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                            <Type className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-gray-900">Display Settings</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-4 tracking-tight uppercase">App Font Size</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'sm', label: 'Small', desc: 'Compact' },
                                        { id: 'base', label: 'Default', desc: 'Standard' },
                                        { id: 'lg', label: 'Large', desc: 'Comfortable' }
                                    ].map(size => (
                                        <button
                                            key={size.id}
                                            onClick={() => handleFontSizeChange(size.id)}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${prefs.fontSize === size.id
                                                ? 'border-blue-600 bg-blue-50/50'
                                                : 'border-gray-100 bg-white hover:border-gray-200'
                                                }`}
                                        >
                                            <p className={`font-black tracking-tight ${prefs.fontSize === size.id ? 'text-blue-700' : 'text-gray-900'
                                                }`}>{size.label}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{size.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Dashboard Sections */}
                    {sections.map((section, idx) => (
                        <section key={idx} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                                {section.icon}
                                <div>
                                    <h3 className="font-bold text-gray-900">{section.title}</h3>
                                    <p className="text-[10px] text-gray-500 font-medium">{section.description}</p>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {section.items.map(item => (
                                        <label key={item.key} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/20 cursor-pointer transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${prefs[item.key as keyof typeof prefs] ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    <Eye className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-700 group-hover:text-blue-700 transition-colors uppercase tracking-tight">{item.label}</span>
                                            </div>
                                            <div className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={!!prefs[item.key as keyof typeof prefs]}
                                                    onChange={() => handleToggle(item.key)}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </section>
                    ))}
                </div>

                <div className="space-y-6">
                    <div className="bg-linear-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl shadow-gray-200">
                        <div className="flex items-center gap-3 mb-4">
                            <Monitor className="w-5 h-5 text-blue-400" />
                            <h3 className="font-bold">Live Preview</h3>
                        </div>
                        <p className="text-xs text-gray-400 mb-6 leading-relaxed">Changes to font size and dashboard visibility will be applied immediately across your workspace after saving.</p>

                        <div className="space-y-4">
                            <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-2/3" />
                            </div>
                            <div className="flex gap-2">
                                <div className="h-8 w-8 bg-gray-700 rounded-lg" />
                                <div className="h-8 w-24 bg-gray-700 rounded-lg" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                        <h4 className="font-bold text-blue-900 mb-2">Need Help?</h4>
                        <p className="text-sm text-blue-700 leading-relaxed mb-4">If you're having trouble with your settings, please contact your system administrator.</p>
                        <a href="mailto:support@skyprint.com" className="text-sm font-bold text-blue-600 hover:text-blue-800">Contact Support &rarr;</a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withAuth(SettingsPage, { permission: Permission.SETTINGS_VIEW });
