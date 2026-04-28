'use client';

import { CheckCircle, FileText, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { configureRun } from '@/services/run.service';
import { ProcessRun } from '@/domain/model/run.model';

interface RunCommentEditorProps {
    orderId: string;
    processId: string;
    run: ProcessRun;
    onRefresh?: () => Promise<void>;
    canEdit?: boolean;
}

export default function RunCommentEditor({
    orderId,
    processId,
    run,
    onRefresh,
    canEdit = true
}: RunCommentEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [commentText, setCommentText] = useState(run.comments || '');
    const [isSaving, setIsSaving] = useState(false);

    // Sync local state with prop when run changes
    useEffect(() => {
        setCommentText(run.comments || '');
    }, [run.comments]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await configureRun(
                orderId,
                processId,
                run.id,
                run.values || {},
                (run.values as any)?.images || [],
                run.executor?.id,
                run.reviewer?.id,
                undefined, // deprecated locationId
                commentText
            );

            if (response.success) {
                setIsEditing(false);
                if (onRefresh) await onRefresh();
            }
        } catch (err) {
            console.error('Failed to save comment:', err);
            alert('Failed to save comment');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isEditing) {
        return (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded group relative">
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Run Comments
                    </label>
                    {canEdit && (
                        <button
                            onClick={() => {
                                setCommentText(run.comments || '');
                                setIsEditing(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 hover:text-blue-800 font-bold transition-opacity"
                        >
                            EDIT
                        </button>
                    )}
                </div>
                {run.comments ? (
                    <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                        {run.comments}
                    </p>
                ) : (
                    <p className="text-xs text-amber-600 italic">No comments added</p>
                )}
                
                {canEdit && !run.comments && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="mt-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold"
                    >
                        + ADD COMMENT
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="mt-2 p-2 bg-white border border-blue-200 rounded shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2">
                 <label className="text-[10px] font-bold text-blue-800 uppercase flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Editing Comments
                </label>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Save"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => setIsEditing(false)}
                        disabled={isSaving}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Cancel"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                autoFocus
                className="w-full text-sm p-2 border border-blue-100 rounded focus:ring-1 focus:ring-blue-500 outline-none min-h-[80px] bg-blue-50/30"
                placeholder="Add run notes..."
            />
        </div>
    );
}
