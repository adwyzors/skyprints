
export const getRunBillingMetrics = (
    run: {
        values?: any;
        billingFormula?: string;
        runTemplate?: {
            billingFormula?: string;
            fields?: { key: string; formulaKey: string }[];
        }
    },
    processName: string,
    orderQuantity: number
) => {
    const values = (run.values || {}) as any;
    let quantity = 0;
    let amount = 0;

    // 1. Try Dynamic Formula (Unified Logic)
    const formula = run.billingFormula || run.runTemplate?.billingFormula;
    if (formula) {
        // Matches "something * new_rate" or "new_rate * something"
        const match = formula.match(/([a-zA-Z0-9_]+)\s*\*\s*new_rate/) ||
            formula.match(/new_rate\s*\*\s*([a-zA-Z0-9_]+)/);

        if (match) {
            const baseKey = match[1];

            // Resolve value from keys: Direct > Template Field Mapping > Case-insensitive/Fuzzy fallback
            let val = values[baseKey];

            if (val === undefined && run.runTemplate?.fields) {
                const field = run.runTemplate.fields.find(f => f.formulaKey === baseKey);
                if (field) {
                    val = values[field.key];
                }
            }

            if (val === undefined) {
                // Fallback: Case-insensitive search
                const lowerBase = baseKey.toLowerCase().replace(/_/g, '');
                const foundKey = Object.keys(values).find(k => {
                    const lowerKey = k.toLowerCase().replace(/[\s_]/g, '');
                    return lowerKey === lowerBase;
                });
                if (foundKey) val = values[foundKey];
            }

            quantity = Number(val) || 0;
        }

        // Attempt to find total amount from typical keys
        amount = Number(values['estimated_amount']) ||
            Number(values['total_amount']) ||
            Number(values['totalAmount']) ||
            Number(values['Estimated Amount']) ||
            Number(values['estimated_amount']) ||
            Number(values['new_amount']) ||
            Number(values['Total Amount']) ||
            Number(values['Actual Total']) || // DTF often uses this
            0;
    }

    // 2. Fallback to Legacy Hardcoded Logic if no formula or quantity not found
    if (quantity === 0 && !formula) {
        // Parse items if stringified
        const items = Array.isArray(values?.items)
            ? values.items
            : typeof values?.items === 'string'
                ? (() => { try { return JSON.parse(values.items); } catch { return []; } })()
                : [];

        switch (processName) {
            case 'Allover Sublimation':
                quantity = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
                amount = Number(values['Total Amount']) || Number(values['total_amount']) || 0;
                break;
            case 'Sublimation':
                // Sum of all 4 columns for all rows
                quantity = items.reduce((sum: number, i: any) => {
                    const rowSum = Array.isArray(i.quantities)
                        ? i.quantities.reduce((rs: number, q: any) => rs + (Number(q) || 0), 0)
                        : 0;
                    return sum + rowSum;
                }, 0);
                amount = Number(values['totalAmount']) || Number(values['total_amount']) || 0;
                break;
            case 'Plotter':
                quantity = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
                amount = Number(values['Total Amount']) || Number(values['total_amount']) || 0;
                break;
            case 'Positive':
                quantity = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0) || orderQuantity;
                amount = Number(values['Total Amount']) || Number(values['total_amount']) || 0;
                break;
            case 'Screen Printing':
                quantity = Number(values['Quantity']) || Number(values['quantity']) || 0;
                amount = Number(values['Estimated Amount']) || Number(values['estimated_amount']) || 0;
                break;
            case 'Embellishment':
                quantity = Number(values['Quantity']) || Number(values['quantity']) || 0;
                amount = Number(values['Estimated Amount']) || Number(values['Total Amount']) || Number(values['total_amount']) || Number(values['estimated_amount']) || 0;
                break;
            case 'DTF':
                quantity = Number(values['Total Layouts']) || orderQuantity || 0;
                amount = Number(values['Actual Total']) || Number(values['Total Amount']) || 0;
                break;
            case 'Diamond':
                quantity = Number(values['Quantity']) || orderQuantity || 0;
                amount = Number(values['Total Amount']) || Number(values['Actual Total']) || 0;
                break;
            case 'Spangle':
                quantity = Number(values['Quantity']) || Number(values['quantity']) || orderQuantity || 0;
                amount = Number(values['Estimated Amount']) || Number(values['estimated_amount']) || 0;
                break;
            default:
                quantity = Number(values['Total Quantity']) || Number(values['totalQuantity']) || Number(values['total_quantity']) || (values?.['Quantity'] as number) || orderQuantity || 0;
                amount = Number(values['Total Amount']) || Number(values['totalAmount']) || Number(values['total_amount']) || Number(values['Estimated Amount']) || Number(values['Actual Total']) || 0;
        }
    }

    const ratePerPc = quantity > 0 ? amount / quantity : 0;
    return { quantity, amount, ratePerPc };
};
