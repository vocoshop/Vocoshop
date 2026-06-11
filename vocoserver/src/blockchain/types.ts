export type DocumentType =
  | "invoice"
  | "sales_report"
  | "activity_report"
  | "payment_history"
  | "subscription_report"
  | "supplier_contract"
  | "microfinance_contract"
  | "payment_proof"
  | "merchant_certificate"
  | "confidence_score"
  | "delivery_proof"
  | "transaction_history";

export interface CertificationRequest {
  storeId: string;
  documentType: DocumentType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface CertificationResult {
  id: string;
  documentType: DocumentType;
  contentHash: string;
  chainHash: string;
  previousHash: string | null;
  anchorType: "database" | "blockchain";
  txHash: string | null;
  blockNumber: number | null;
  chainId: string | null;
  explorerUrl: string | null;
  chainLabel: string | null;
  storeId: string;
  createdAt: Date;
  verifiedAt?: Date;
}

export interface VerificationResult {
  isValid: boolean;
  document: {
    id: string;
    documentType: DocumentType;
    storeId: string;
    createdAt: Date;
  } | null;
  chain: {
    chainHash: string;
    previousHash: string | null;
    anchorType: string;
    txHash: string | null;
    blockNumber: number | null;
  } | null;
  integrityCheck: {
    computedHash: string;
    storedHash: string;
    matches: boolean;
  };
  chainIntegrity: {
    isLinked: boolean;
    expectedPreviousHash: string | null;
    actualPreviousHash: string | null;
  };
}

export interface ScoreComponent {
  name: string;
  label: string;
  value: number;
  weight: number;
  score: number;
  maxScore: number;
}

export interface VocoScoreData {
  storeId: string;
  overallScore: number;
  components: ScoreComponent[];
  periodStart: Date;
  periodEnd: Date;
  transactionCount: number;
  averageMonthlyTransactions: number;
  accountAgeDays: number;
  subscriptionRegularity: number;
  stockManagementScore: number;
  revenueStability: number;
}

export interface PartnerApp {
  id: string;
  name: string;
  apiKey: string;
  permissions: string[];
  storeId?: string;
  active: boolean;
  createdAt: Date;
}

export interface VerificationRequestLog {
  id: string;
  partnerId: string;
  partnerName: string;
  storeId: string;
  documentId?: string;
  documentType?: DocumentType;
  action: "verify_document" | "verify_score" | "request_report";
  ip: string;
  success: boolean;
  createdAt: Date;
}
