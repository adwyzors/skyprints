"use client";

import { useState } from "react";
import { Process, ProcessRun } from "@/types/domain";
import { configureRun } from "@/services/orders.service";
import { X } from "lucide-react";

interface ConfigureRunModalProps {
  orderId: string;
  process: Process;
  run: ProcessRun;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConfigureRunModal({
  orderId,
  process,
  run,
  onClose,
  onSuccess,
}: ConfigureRunModalProps) {
  /* ================= FIELD DEFINITIONS ================= */

  // Field schema comes from backend via runTemplate
  const fieldDefinitions = run.runTemplate?.fields ?? [];

  /* ================= FORM STATE ================= */

  const [formData, setFormData] = useState<Record<string, any>>(() =>
    fieldDefinitions.reduce((acc, field) => {
      acc[field.key] = run.fields[field.key] ?? "";
      return acc;
    }, {} as Record<string, any>)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ================= HANDLERS ================= */

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await configureRun(orderId, process.id, run.id, formData);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to configure run:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= FIELD RENDERING ================= */

  const renderField = (
    fieldName: string,
    fieldType: string,
    required: boolean
  ) => {
    if (fieldType === "number") {
      return (
        <input
          type="number"
          value={formData[fieldName] ?? ""}
          onChange={e =>
            handleInputChange(
              fieldName,
              e.target.value === "" ? "" : Number(e.target.value)
            )
          }
          required={required}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }

    return (
      <input
        type="text"
        value={formData[fieldName] ?? ""}
        onChange={e => handleInputChange(fieldName, e.target.value)}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  };

  /* ================= UI ================= */

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* HEADER */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Configure Run {run.runNumber}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {process.name} • Order: {orderId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]"
        >
          <div className="space-y-4">
            {fieldDefinitions.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, str => str.toUpperCase())}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                {renderField(field.key, field.type, field.required)}
              </div>
            ))}
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Configuring..." : "Save Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
