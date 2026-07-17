export type UserRole = "owner" | "admin" | "employee" | "inventorist";

export type UserPermissions = Record<string, boolean>;

export interface User {
  _id: string;
  phone: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
  permissions: Record<string, boolean> | string[];
  store: string;
  ownershipStatus?: string;
  storeName?: string;
  deviceId?: string;
  lastLoginAt?: string;
}