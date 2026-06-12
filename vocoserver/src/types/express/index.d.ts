declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }

  interface AuthUser {
    id: string;
    userId?: string;
    storeId: string | null;
    role: string;
    permissions: Record<string, any>;
    agentCode?: string;
    storeName?: string;
    name?: string;
    phone?: string;
  }

  interface AgentUser {
    id?: string;
    code: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    codeNumber?: string;
    codeSuffix?: string;
    city?: string;
    region?: string;
    country?: string;
    gender?: string;
    birthDate?: string | null;
    idType?: string;
    idNumber?: string;
    idPhotoPath?: string;
    selfiePhotoPath?: string;
    isApproved?: boolean;
    isActive?: boolean;
    mustChangePassword?: boolean;
    lastLoginAt?: Date | null;
    createdAt?: Date | null;
    type?: string;
    role?: string;
  }

  interface ManagerUser {
    managerId: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    assignedRegions?: string[];
    assignedCities?: string[];
    role?: string;
  }

  interface SubscriptionInfo {
    active?: boolean;
    access?: boolean;
    status?: string;
    subscriptionStatus?: string;
    plan?: string;
    message?: string;
    paidUntil?: string;
    daysLeft?: number;
    installedAt?: string;
    graceUntil?: string;
  }

  interface Request {
    user?: AuthUser;
    agent?: AgentUser;
    manager?: ManagerUser;
    subscription?: SubscriptionInfo;
  }
}
