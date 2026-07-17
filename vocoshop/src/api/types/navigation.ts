import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Employee } from "../services/employeeService";

export type RootStackParamList = {
  Entry: undefined;
  Login: { preselectedPhone?: string; selectedStoreName?: string; reauth?: boolean } | undefined;
  StorePicker: { stores: any[]; ownerPhone: string };
  Onboarding: { phone?: string; ownerPhone?: string; callingCode?: string; countryCode?: string };
  SubscriptionBlocked: undefined;
  Home: undefined;

  Invite: { token?: string };

  Commander: { supplierId?: string; supplierName?: string };
  Orders: undefined;
  CreateOrder: undefined;
  EditOrder: { orderId: string };
  OrderHistory: undefined;
  OrderDetail: { orderId: string };

  MesFournisseurs: undefined;
  Suppliers: undefined;
  SupplierDetail: { supplierId: string };
  EditSupplier: { supplierId: string };
  SupplierProducts: { supplierId: string; supplierName?: string };

  Report: undefined;
  ReportDetail: { reportId: string };
  MyReports: undefined;

  Inventory: { justCounted?: boolean; countedAt?: number; refresh?: number } | undefined;
  AddProduct: { product?: any; fromInventory?: boolean } | undefined;
  InventoryDetails: { data: any };
  AppliedInventoryDetail: { sessionId: string };

  Stock: undefined;
  AddStock: { refresh?: number } | undefined;
  StockProductDetails: { product?: any; productId?: string };
  CreateProduct: { mode?: string; prefill?: any; photoBase64?: string } | undefined;
  RemoveStock: undefined;
  StockRemoveDetails: { product: any };

  History: { storeId?: string } | undefined;
  StockHistory: undefined;
  StockDayDetail: { date: string; items: any[] };

  Profile: undefined;
  Funding: undefined;
  AcceptInvitation: { token?: string; phone?: string };
  StoreCreated: { shareLink?: string; storeName?: string; ownerPhone?: string; invitationId?: string };
  GestionPartenaires: undefined;
  MyAgent: undefined;
  Notifications: undefined;
  PersonalInfo: undefined;
  InvoiceList: { invoices: any[] };
  InvoiceDetail: { invoice: any };

  MyShop: undefined;
  ManageShop: undefined;
  Subscription: undefined;
  SubscriptionPay: undefined;
  SubscriptionCheckout: undefined;
  YabetooWebView: { checkoutUrl: string; customerName?: string; customerPhone?: string };

  Employees: undefined;
  EmployeeCreate: undefined;
  EmployeeEdit: { employee: Employee };

  InventorySessions: undefined;
  ConsolidatedInventory: undefined;
  InventoryAnalysis: undefined;
  InventorySessionDetail: { sessionId: string };
  FinishInventory: { sessionId?: string; storeId?: string; lines?: any[]; completedAt?: any } | undefined;
  InventoryImpact: undefined;

  StockHealth: { mode?: "low" | "expiring" } | undefined;
  Sales: undefined;
  OcrScan: undefined;
  OcrValidation: { scan: any };
  PhotoStock: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
