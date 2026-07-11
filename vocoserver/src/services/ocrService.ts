import crypto from "crypto";
import OcrScan, { IOcrLine } from "../models/OcrScan";
import ProductAlias from "../models/ProductAlias";
import Product from "../models/Product";
import Sale from "../models/Sales";
import { preprocessForVision, analyzeImageQuality } from "./imagePreprocess";
import { isValidObjectId } from "../utils/helpers";

interface OcrEngineResult {
  rawText: string;
  confidence: number;
  engine: string;
}

interface ParseLineResult {
  text: string;
  productName?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  confidence: number;
  type: IOcrLine["type"];
}

function removeBase64Header(imageBase64: string): string {
  return imageBase64.replace(/^data:image\/\w+;base64,/, "");
}

export class OcrService {
  private readonly MIN_CONFIDENCE = 30;

  async scanDocument(
    storeId: string,
    images: string[],
    options?: { pageCount?: number; defaultLineType?: IOcrLine["type"] }
  ): Promise<typeof OcrScan.prototype.toObject> {
    if (!images || images.length === 0) {
      throw new Error("Au moins une image requise");
    }

    const allLines: IOcrLine[] = [];
    const allTexts: string[] = [];
    let totalConfidence = 0;
    let anyNeedsReview = false;

    for (const img of images) {
      const validated = this.validateImage(img);
      if (!validated.valid) {
        throw new Error(validated.error || "Image invalide");
      }

      const enhanced = this.preprocessImage(img);
      const engineResult = await this.runOcrEngines(enhanced);
      const lines = await this.parseLines(storeId, engineResult.rawText, options?.defaultLineType);

      allTexts.push(engineResult.rawText);
      allLines.push(...lines);
      totalConfidence += engineResult.confidence;

      if (engineResult.confidence < 60 || lines.length === 0) {
        anyNeedsReview = true;
      }
    }

    const avgConfidence = Math.round(totalConfidence / images.length);

    const scan = await OcrScan.create({
      storeId,
      images,
      rawText: allTexts.join("\n---\n"),
      lines: allLines,
      globalConfidence: avgConfidence,
      needsReview: anyNeedsReview,
      status: "pending",
      pageCount: options?.pageCount ?? images.length,
    });

    return scan.toObject();
  }

  async validateScan(
    scanId: string,
    storeId: string,
    validatedLines: IOcrLine[],
    feedback?: Record<string, string>
  ): Promise<typeof OcrScan.prototype.toObject> {
    if (!isValidObjectId(scanId)) throw new Error("ID scan invalide");
    const scan = await OcrScan.findOne({ _id: scanId, storeId });
    if (!scan) throw new Error("Scan introuvable");

    for (const line of validatedLines) {
      if (line.corrected && line.productName && line.text !== line.productName) {
        await this.learnAlias(storeId, line.text, line.productName, line.productId);
      }
    }

    scan.lines = validatedLines;
    scan.validatedByUser = true;
    scan.status = "validated";
    if (feedback) scan.correctionFeedback = feedback;
    await scan.save();

    return scan.toObject();
  }

  async importValidatedScan(
    scanId: string,
    storeId: string
  ): Promise<{ importedCount: number; errors: string[]; unmatchedCount: number }> {
    if (!isValidObjectId(scanId)) throw new Error("ID scan invalide");
    const scan = await OcrScan.findOne({ _id: scanId, storeId, status: { $in: ["validated", "pending"] } });
    if (!scan) throw new Error("Scan introuvable. Valide d'abord le scan avant d'importer.");

    if (scan.status === "pending") {
      scan.validatedByUser = true;
      scan.status = "validated";
      await scan.save();
    }

    const errors: string[] = [];
    let importedCount = 0;
    let unmatchedCount = 0;

    for (const line of scan.lines) {
      if (line.confidence < this.MIN_CONFIDENCE) {
        errors.push(`Confiance trop faible: "${line.text}"`);
        continue;
      }

      if (!line.productId) {
        unmatchedCount++;
        continue;
      }

      if (!line.quantity) {
        errors.push(`Quantité non détectée: "${line.text}"`);
        continue;
      }
      if (typeof line.quantity !== "number" || line.quantity < 1) {
        errors.push(`Quantité invalide: "${line.text}"`);
        continue;
      }

      try {
        const product = await Product.findById(line.productId);
        if (!product) {
          errors.push(`Produit introuvable: "${line.text}"`);
          continue;
        }
        const increment = line.type === "sale" ? -line.quantity : line.quantity;
        await Product.findByIdAndUpdate(line.productId, { $inc: { quantity: increment } });
        // Créer un enregistrement Sale pour les KPIs
        if (line.type === "sale") {
          const unitPrice = line.unitPrice ?? product.sellPrice ?? 0;
          const totalAmount = line.total ?? (line.quantity * unitPrice);
          await Sale.create({
            storeId,
            productId: line.productId,
            productName: line.productName || product.name,
            quantity: line.quantity,
            unitPrice,
            purchasePriceAtSale: product.purchasePrice ?? 0,
            totalAmount,
            businessDate: new Date().toISOString().split("T")[0],
            isVoiced: false,
            isReverted: false,
          });
        }
        importedCount++;
      } catch {
        errors.push(`Erreur mise à jour stock: "${line.text}"`);
      }
    }

    scan.status = "imported";
    await scan.save();

    return { importedCount, errors, unmatchedCount };
  }

  private validateImage(imageBase64: string): { valid: boolean; error?: string } {
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return { valid: false, error: "Image requise" };
    }

    const raw = removeBase64Header(imageBase64);
    if (!raw || raw.length < 50) {
      return { valid: false, error: "Image vide ou trop petite" };
    }

    const sizeBytes = (raw.length * 3) / 4;
    const sizeMB = sizeBytes / (1024 * 1024);

    if (sizeMB > 15) {
      return { valid: false, error: "Image trop volumineuse (max 15 MB)" };
    }

    const validMime = /^data:image\/(jpeg|png|webp);base64,/.test(imageBase64);
    if (!validMime && /^data:image/.test(imageBase64)) {
      return { valid: false, error: "Format d'image non supporté (JPEG, PNG ou WebP uniquement)" };
    }

    try {
      Buffer.from(raw, "base64");
    } catch {
      return { valid: false, error: "Image corrompue" };
    }

    return { valid: true };
  }

  private preprocessImage(base64: string): string {
    return base64;
  }

  /* =====================================================
  OCR ENGINE — MULTI-MOTEUR AVEC FALLBACK
  Ordre : OpenAI Vision > Mistral OCR > Tesseract.js
  ===================================================== */
  private async runOcrEngines(imageBase64: string): Promise<OcrEngineResult> {
    const openaiKey = process.env.OPENAI_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;

    if (openaiKey) {
      try {
        const preprocessed = await preprocessForVision(imageBase64);
        const base64Clean = preprocessed.buffer.toString("base64");
        const result = await this.runOpenaiVision(base64Clean, openaiKey, preprocessed.mimeType);
        return result;
      } catch (err) {
        console.error("OpenAI Vision failed, falling back:", (err as Error).message);
      }
    }

    if (mistralKey) {
      try {
        const result = await this.runMistralOcr(imageBase64, mistralKey);
        if (result.rawText.trim()) return result;
      } catch (err) {
        console.error("Mistral OCR failed, falling back:", (err as Error).message);
      }
    }

    return this.runTesseract(imageBase64);
  }

  private cleanOcrResult(raw: string): string {
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        const lower = l.toLowerCase();
        if (lower.startsWith("voici") || lower.startsWith("voilà")) return false;
        if (/^confiance\s*[:\s].*%/.test(lower)) return false;
        if (/^```/.test(l.trim())) return false;
        if (/^[\s]*---/.test(l)) return false;
        if (/\b(extrait|ocr|scan|image|document|cahier)\b/.test(lower) && /^[a-z]/.test(lower) && (lower.includes("texte") || lower.includes("suivant"))) return false;
        return true;
      })
      .join("\n");
  }

  private async runOpenaiVision(
    imageBase64: string,
    apiKey: string,
    mimeType: string = "image/jpeg"
  ): Promise<OcrEngineResult> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_OCR_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Tu es un expert OCR spécialisé dans la lecture de cahiers de commerce manuscrits en Afrique centrale.\n\n" +
              "RÈGLES ABSOLUES :\n" +
              "1. Tu ne réponds QU'avec le texte brut extrait, AUCUN préambule, AUCUNE explication.\n" +
              "2. Recopie CHAQUE ligne exactement comme elle est écrite, sans reformuler.\n" +
              "3. Conserve les abbreviations courantes : kg, g, l, ml, pce, ct, pa, etc.\n" +
              "4. Les nombres s'écrivent souvent sans séparateur : 5000, 15000, etc.\n" +
              "5. Les unités monétaires sont FCFA ou F (ex: 500F, 5000F).\n" +
              "6. Les produits sont souvent en français ou en langues locales (lingala, etc.).\n" +
              "7. Les quantités précédées de 'x' signifient multiplication : 2x500 = 2 unités à 500.\n" +
              "8. Si tu ne vois pas de texte, réponds une chaîne vide.\n" +
              "9. NE JAMAIS ajouter de commentaires entre parenthèses ou de annotations.\n" +
              "10. Les tirets, croix (x), et puces sont des séparateurs de colonnes, pas du texte.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_completion_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const data: any = await response.json();
    const rawText = this.cleanOcrResult(data?.choices?.[0]?.message?.content || "");

    const totalTokens = data?.usage?.total_tokens || 0;
    const confidence = Math.min(85 + Math.round(totalTokens / 100), 98);

    return { rawText, confidence, engine: "openai" };
  }

  private async runMistralOcr(
    imageBase64: string,
    apiKey: string
  ): Promise<OcrEngineResult> {
    const base64 = removeBase64Header(imageBase64);
    const response = await fetch(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extrais tout le texte visible sur cette image. Réponds UNIQUEMENT avec le texte brut, sans préambule, sans explication, sans formatage. Recopie chaque ligne exactement.",
                },
                {
                  type: "image_url",
                  image_url: `data:image/jpeg;base64,${base64}`,
                },
              ],
            },
          ],
        max_completion_tokens: 4096,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mistral API error ${response.status}: ${text}`);
    }

    const data: any = await response.json();
    const rawText = this.cleanOcrResult(data?.choices?.[0]?.message?.content || "");
    return { rawText, confidence: 80, engine: "mistral" };
  }

  private async runTesseract(imageBase64: string): Promise<OcrEngineResult> {
    const Tesseract = await import("tesseract.js");
    const base64 = removeBase64Header(imageBase64);
    const buf = Buffer.from(base64, "base64");

    const { data } = await Tesseract.recognize(buf, "fra+eng", {
      logger: undefined,
    });

    const rawText = data.text || "";
    const confidence = Math.round(data.confidence);

    return { rawText, confidence, engine: "tesseract" };
  }

  private async parseLines(
    storeId: string,
    rawText: string,
    defaultLineType?: IOcrLine["type"]
  ): Promise<IOcrLine[]> {
    const products = await Product.find({ storeId }).lean();
    const lines = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const results: IOcrLine[] = [];

    for (const line of lines) {
      const parsed = await this.parseLine(storeId, line, products, defaultLineType);
      results.push({
        text: line,
        productName: parsed.productName,
        productId: parsed.productId,
        quantity: parsed.quantity,
        unitPrice: parsed.unitPrice,
        total: parsed.total,
        confidence: parsed.confidence,
        type: parsed.type,
        corrected: false,
      });
    }

    return results;
  }

  private hasQtyPricePattern(line: string): boolean {
    return /(\d+)\s*(x|×)\s*(\d+)/i.test(line);
  }

  private async parseLine(
    storeId: string,
    line: string,
    products: any[],
    defaultLineType?: IOcrLine["type"]
  ): Promise<ParseLineResult> {
    const lower = line.toLowerCase();

    const knownProduct = this.matchProduct(line, products);
    let quantity = this.extractQuantity(line);
    const prices = this.extractPrices(line);
    const detectedType = this.detectLineType(lower);
    const type = detectedType === "unknown" && defaultLineType ? defaultLineType : detectedType;

    const sellPrice = knownProduct ? (knownProduct as any).sellPrice ?? 0 : 0;
    const isQtyPricePat = this.hasQtyPricePattern(line);

    let unitPrice: number | undefined;
    let total: number | undefined;
    const confidence = knownProduct ? 85 : 40;

    if (knownProduct && prices.length > 0) {
      if (quantity) {
        if (isQtyPricePat) {
          // "2 x 500" → price après "x" = unitPrice
          const m = line.match(/(\d+)\s*(x|×)\s*(\d+)/i);
          unitPrice = m ? parseInt(m[3], 10) : Math.round(prices[prices.length - 1] / quantity);
          total = quantity * unitPrice;
        } else if (sellPrice > 0 && prices.length === 1 && prices[0] === sellPrice) {
          // "10 Savon 500" → prix = unitPrice, total = qty * unitPrice
          unitPrice = sellPrice;
          total = quantity * sellPrice;
        } else {
          const lastPrice = prices[prices.length - 1];
          unitPrice = Math.round(lastPrice / quantity);
          total = lastPrice;
        }
      } else if (sellPrice > 0) {
        const lastPrice = prices[prices.length - 1];
        if (lastPrice === sellPrice) {
          quantity = 1;
          unitPrice = sellPrice;
          total = sellPrice;
        } else if (lastPrice > sellPrice) {
          const quotient = lastPrice / sellPrice;
          if (Number.isInteger(quotient)) {
            quantity = quotient;
            unitPrice = sellPrice;
            total = lastPrice;
          } else {
            quantity = 1;
            unitPrice = sellPrice;
            total = lastPrice;
          }
        } else {
          quantity = 1;
          unitPrice = lastPrice;
          total = lastPrice;
        }
      } else {
        quantity = 1;
        unitPrice = prices[0];
        total = prices.length > 1 ? prices[prices.length - 1] : prices[0];
      }
    } else if (knownProduct && sellPrice > 0) {
      quantity = quantity || 1;
      unitPrice = sellPrice;
      total = quantity * sellPrice;
    } else {
      quantity = quantity || 1;
      unitPrice = prices.length > 0 ? prices[0] : undefined;
      total = prices.length > 1 ? prices[prices.length - 1] : undefined;
    }

    return {
      text: line,
      productName: knownProduct?.name,
      productId: knownProduct?._id?.toString(),
      quantity,
      unitPrice,
      total,
      confidence,
      type,
    };
  }

  private matchProduct(
    text: string,
    products: any[]
  ): (typeof products)[0] | null {
    const lower = text.toLowerCase().trim();
    const words = lower.split(/\s+/).filter(Boolean);

    if (!words.length || !products.length) return null;

    let best: { product: any; score: number } | null = null;

    for (const p of products) {
      const pName = p.name.toLowerCase().trim();
      const pAliases = (p.aliases || []).map((a: string) => a.toLowerCase().trim());
      const pWords = pName.split(/\s+/).filter(Boolean);

      let score = 0;

      if (pName === lower) score = 100;
      else if (pAliases.some((a: string) => a === lower)) score = 95;
      else if (lower.includes(pName)) score = 90;
      else if (pName.includes(lower)) score = 85;
      else if (pAliases.some((a: string) => lower.includes(a))) score = 80;
      else if (pAliases.some((a: string) => a.includes(lower))) score = 75;
      else if (pWords.some((w: string) => words.includes(w))) score = 70;
      else {
        const pWordsContained = pWords.filter((w: string) => lower.includes(w)).length;
        const textWordsContained = words.filter((w: string) => pName.includes(w)).length;

        const pWordsLen = pWords.length || 1;
        const wordsLen = words.length || 1;
        const ratioP = pWordsContained / pWordsLen;
        const ratioT = textWordsContained / wordsLen;

        score = Math.round(Math.max(ratioP, ratioT) * 60);
      }

      if (score > 0 && (!best || score > best.score)) {
        best = { product: p, score };
      }
    }

    if (best && best.score >= 30) return best.product;
    return null;
  }

  private extractQuantity(line: string): number | undefined {
    const patterns = [
      /(\d+)\s*(kg|g|l|ml|unité|pce|pc|carton|sac|sachet|bouteille|bte|boîte|x|fois)/i,
      /^(\d+)\s+(?!\d)/m,
      /(\d+)\s*(x|×)\s*\d+/,
    ];
    for (const pat of patterns) {
      const m = line.match(pat);
      if (m) return parseInt(m[1], 10);
    }
    return undefined;
  }

  private extractPrices(line: string): number[] {
    const normalized = line.replace(/(\d)\s+(?=\d{3})/g, '$1');
    const amounts = normalized.match(/\d{3,}\s*(F|fcfa|franc)?|\d{1,2}\s*(F|fcfa|franc)/gi);
    if (!amounts) return [];
    return amounts.map((a) => parseInt(a.replace(/[\sFfcfa]/gi, ""), 10));
  }

  private detectLineType(lower: string): IOcrLine["type"] {
    if (/\b(vente|vendu|vend|client|payé|payer|encaissé)\b/.test(lower)) return "sale";
    if (/\b(stock|appro|livré|réception|arrivage|fournisseur|achat|commandé)\b/.test(lower)) return "stock_in";
    if (/\b(dépense|frais|transport|électricité|eau|loyer|taxe|charges)\b/.test(lower)) return "expense";
    if (/\b(dette|crédit|prêt|doit|devant|impayé)\b/.test(lower)) return "debt";
    return "unknown";
  }

  private async learnAlias(
    storeId: string,
    rawText: string,
    normalizedName: string,
    productId?: string
  ): Promise<void> {
    const safeProductId = productId && isValidObjectId(productId) ? productId : undefined;
    const product = safeProductId
      ? await Product.findOne({ _id: safeProductId, storeId })
      : await Product.findOne({ storeId, name: String(normalizedName) });

    if (!product) return;

    const existing = await ProductAlias.findOne({ storeId, rawText: String(rawText) });
    if (existing) {
      existing.frequency += 1;
      existing.lastUsed = new Date();
      await existing.save();
    } else {
      await ProductAlias.create({
        storeId,
        productId: product._id.toString(),
        rawText,
        normalizedName: product.name,
      });
    }

    if (!product.aliases.includes(rawText)) {
      product.aliases.push(rawText);
      await product.save();
    }
  }

  async getAliases(storeId: string) {
    return ProductAlias.find({ storeId }).sort({ frequency: -1 }).lean();
  }
}

export const ocrService = new OcrService();
