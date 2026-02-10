export interface Location {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    type: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt?: Date;
}
