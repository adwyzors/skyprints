// --- Specific Process Value Types ---

export interface AlloverSublimationItem {
    design: string;
    height: number;
    rate: number;
    quantity: number;
    amount: number;
}


export interface AlloverRunValues {
    particulars: string | null;
    items: AlloverSublimationItem[];
    [key: string]: any;
}


export interface SpangleRunValues {
    design?: string;
    quantity?: number;
    dotSize?: number;
    cd?: number;
    dotsReq?: number;
    rate?: number;
    amount?: number;
    images?: string[];
    [key: string]: any;
}

export interface LaserItem {
    designSizes: string;
    quantity: number;
    fSizes: string;
    laserTime: number;
    rate: number;
    amount: number;
}

export interface LaserRunValues {
    particulars: string | null;
    items: LaserItem[];
    [key: string]: any;
}

export interface PlotterItem {
    fileSizes: string;
    quantity: number;
    sizeW: number;
    sizeH: number;
    layoutHeight: number;
    layoutPcs: number;
    sheetRate: number;
    sheetReq: number;
    rate: number;
    total: number;
}

export interface PlotterRunValues {
    particulars: string | null;
    sheetsToCut: string | null;
    items: PlotterItem[];
    images?: string[];
    [key: string]: any;
}

export interface DiamondItem {
    designSizes: string;
    quantity: number;
    fSize: string; // default 'all'
    diamond: string;
    time: number;
    rate: number;
    amount: number;
}

export interface DiamondRunValues {
    particulars: string | null;
    items: DiamondItem[];
    images?: string[];
    [key: string]: any;
}

export interface DTFItem {
    particulars?: string; // New field
    height: number;
    pcsPerLayout: number;
    quantityActual: number;
    adjustment: number;
    fromOther: number; // New field
    // Computed (optional for storage, but good for type safety if we store them)
    quantityRequired?: number;
    numberOfLayouts?: number;
    area?: number;
    pricePerLayout?: number;
    rowTotal?: number;
}

export interface DTFRunValues {
    particulars: string | null;
    isFusing: boolean;
    isJobDifference: boolean;
    pcs: number;
    customPcs?: number;
    rate: number;
    items: DTFItem[];
    images?: string[];
    [key: string]: any;
}

export interface PositiveItem {
    description: string;
    width: number;
    height: number;
    amount: number;
}

export interface PositiveRunValues {
    particulars: string | null;
    rate: number;
    items: PositiveItem[];
    images?: string[];
    [key: string]: any;
}

export interface SublimationItem {
    size: string;
    width: number;
    height: number;
    quantities: [number | string, number | string, number | string, number | string]; // 4 dynamic columns, allow empty string for input UX
    // Calculated
    sum?: number;
    rowRate?: number;
    rowTotal?: number;
}

export interface SublimationRunValues {
    rate: number;
    columnHeaders: [string, string, string, string];
    items: SublimationItem[];
    // Summaries
    totalQuantity?: number;
    avgRate?: number;
    totalAmount?: number;
    totalMeters?: number;
    totals?: [number, number, number, number]; // column totals

    images?: string[];
    [key: string]: any;
}

export interface ProcessRun {
    id: string;
    runNumber: number;
    displayName: string;
    configStatus: string;
    lifecycleStatus: string;
    lifecycle: Array<{
        code: string;
        completed: boolean;
    }>;
    executor?: {
        id: string;
        name: string;
    } | null;
    reviewer?: {
        id: string;
        name: string;
    } | null;
    locationId?: string | null;
    location?: {
        id: string;
        code: string;
        name: string;
    } | null;
    values:
    | Record<string, any>
    | AlloverRunValues
    | LaserRunValues
    | PlotterRunValues
    | PositiveRunValues
    | DiamondRunValues
    | DTFRunValues
    | SublimationRunValues
    | SpangleRunValues; // Widened to allow complex objects
    fields: Array<{ // This is now an array, not in runTemplate
        key: string;
        type: string;
        required: boolean;
    }>;
    billingFormula?: string;
}

export interface RunField {
    key: string;
    type: string;
    required: boolean;
}
