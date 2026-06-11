import crypto from "crypto";
import BlockchainProof from "../models/BlockchainProof";

export async function checkBlockchainRpcAvailability(): Promise<boolean> {
  const rpc = process.env.BLOCKCHAIN_RPC || "";
  if (!rpc) return false;
  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(rpc);
    await provider.getNetwork();
    console.log("✅ Connexion RPC blockchain établie");
    return true;
  } catch (e) {
    console.warn("⚠️ RPC blockchain configuré mais injoignable :", (e as Error).message);
    return false;
  }
}

const EXPLORER_URLS: Record<string, string> = {
  "137": "https://polygonscan.com/tx/",
  "80001": "https://mumbai.polygonscan.com/tx/",
  "56": "https://bscscan.com/tx/",
  "97": "https://testnet.bscscan.com/tx/",
  "1": "https://etherscan.io/tx/",
  "11155111": "https://sepolia.etherscan.io/tx/",
};

function getChainLabel(chainId: string): string {
  const labels: Record<string, string> = {
    "137": "Polygon", "80001": "Polygon Mumbai",
    "56": "BNB Chain", "97": "BNB Testnet",
    "1": "Ethereum", "11155111": "Sepolia",
  };
  return labels[chainId] || `Chain ${chainId}`;
}

async function anchorOnBlockchain(
  dataHash: string,
  _storeId: string,
  _month: string
): Promise<{ txHash: string | null; blockNumber: number | null; chainId: string | null; explorerUrl: string | null }> {
  const rpc = process.env.BLOCKCHAIN_RPC || "";
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || "";
  const chainId = process.env.BLOCKCHAIN_CHAIN_ID || "137";

  if (!rpc || !privateKey) {
    return { txHash: null, blockNumber: null, chainId: null, explorerUrl: null };
  }

  try {
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(privateKey, provider);

    const tx = await wallet.sendTransaction({
      to: wallet.address,
      data: "0x" + dataHash,
    });

    const receipt = await tx.wait();
    const baseUrl = EXPLORER_URLS[chainId] || "";
    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber || null,
      chainId,
      explorerUrl: baseUrl ? `${baseUrl}${tx.hash}` : null,
    };
  } catch (e) {
    console.error("❌ blockchain anchor failed:", e);
    return { txHash: null, blockNumber: null, chainId: null, explorerUrl: null };
  }
}

async function getPreviousHash(): Promise<string | null> {
  try {
    const last = await BlockchainProof.findOne().sort({ createdAt: -1 }).lean();
    return last ? String(last.dataHash) : null;
  } catch {
    return null;
  }
}

function hashChain(dataHash: string, previousHash: string | null): string {
  return crypto
    .createHash("sha256")
    .update(dataHash + (previousHash || "genesis"))
    .digest("hex");
}

export async function anchorReport(params: {
  dataHash: string;
  storeId: string;
  month: string;
}): Promise<{
  type: "database" | "blockchain";
  chainHash: string;
  previousHash: string | null;
  txHash: string | null;
  blockNumber: number | null;
  chainId: string | null;
  explorerUrl: string | null;
  chainLabel: string | null;
}> {
  const { dataHash, storeId, month } = params;

  // Get previous anchor for chaining
  const previousHash = await getPreviousHash();

  // Create chained hash (Merkle-style proof chain)
  const chainHash = hashChain(dataHash, previousHash);

  // Try real blockchain anchoring if configured
  const onChain = await anchorOnBlockchain(chainHash, storeId, month);

  const type = onChain.txHash ? "blockchain" : "database";

  // Store the proof
  await BlockchainProof.create({
    dataHash: chainHash,
    contentHash: dataHash,
    previousHash,
    anchorType: type,
    txHash: onChain.txHash,
    blockNumber: onChain.blockNumber,
    chainId: onChain.chainId,
    explorerUrl: onChain.explorerUrl,
    storeId,
    month,
  });

  return {
    type,
    chainHash,
    previousHash,
    txHash: onChain.txHash,
    blockNumber: onChain.blockNumber,
    chainId: onChain.chainId,
    explorerUrl: onChain.explorerUrl,
    chainLabel: onChain.chainId ? getChainLabel(onChain.chainId) : null,
  };
}

export async function getAnchorsForHash(contentHash: string): Promise<any[]> {
  if (!contentHash) return [];
  return BlockchainProof.find({ contentHash })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
}

export async function getProofChain(limit = 10): Promise<any[]> {
  return BlockchainProof.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
