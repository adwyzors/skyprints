import React from 'react';

interface CreditLimitErrorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    message?: string;
}

export default function CreditLimitErrorDialog({ isOpen, onClose, message }: CreditLimitErrorDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-8 text-center border border-red-100">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">⚠️</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Credit Limit Reached</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-8">
                    {message || "This operation cannot be completed because the customer has exceeded their assigned credit limit."}
                    <br/><br/>
                    Please contact administration to adjust the limit or settle outstanding payments.
                </p>
                <button
                    onClick={onClose}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl active:scale-[0.98] transition-all shadow-lg shadow-red-200 flex items-center justify-center"
                >
                    Understood
                </button>
            </div>
        </div>
    );
}
