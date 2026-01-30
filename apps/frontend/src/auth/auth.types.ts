export interface AuthUser {
  id: string;
  alternateEmail?: string;
  roles: string[];
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    location?: any;
  };
}
