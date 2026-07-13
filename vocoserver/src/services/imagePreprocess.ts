import sharp from "sharp";

/**
 * 📸 Pipeline OCR Pro — Prétraitement d'image pour cahiers manuscrits
 *
 * 1. Redimensionnement à 2048px (optimale pour Vision API)
 * 2. Amélioration du contraste (CLAHE simulé)
 * 3. Binarisation adaptative (Otsu simplifié)
 * 4. Nettoyage du bruit
 */
const MAX_DIMENSION = 2048;

export interface PreprocessResult {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Prétraitement principal : envoie une image optimisée pour l'OCR
 */
export async function preprocessForOcr(
  imageBase64: string
): Promise<PreprocessResult> {
  const raw = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const input = Buffer.from(raw, "base64");

  const meta = await sharp(input).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;

  // 1. Resize si trop grande
  let pipeline = sharp(input);
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: w > h ? MAX_DIMENSION : undefined,
      height: h >= w ? MAX_DIMENSION : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // 2. Conversion en grayscale
  pipeline = pipeline.grayscale();

  // 3. Amélioration du contraste (normalisation des histogrammes)
  pipeline = pipeline.normalize();

  // 4. Sharpening léger (netteté des traits)
  pipeline = pipeline.sharpen({ sigma: 1.2, m1: 0.8, m2: 0.4 });

  // 5. Binarisation adaptative via Otsu
  pipeline = pipeline.threshold(0);

  // 6. Output en PNG pour最佳 qualité
  const processed = await pipeline.png({ quality: 95 }).toBuffer();

  return { buffer: processed, mimeType: "image/png" };
}

/**
 * Version légère : juste resize + contraste (pour OpenAI Vision)
 * Pas de binarisation car les modèles gèrent mieux les images couleur
 */
export async function preprocessForVision(
  imageBase64: string
): Promise<PreprocessResult> {
  const raw = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const input = Buffer.from(raw, "base64");

  const meta = await sharp(input).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;

  let pipeline = sharp(input);

  // Resize optimal pour Vision API (ne pas envoyer des images de 12MP)
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: w > h ? MAX_DIMENSION : undefined,
      height: h >= w ? MAX_DIMENSION : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Amélioration du contraste (éclairage marché souvent mauvais)
  pipeline = pipeline.normalize();

  // Léger sharpening pour nettoyer les traits
  pipeline = pipeline.sharpen({ sigma: 0.8, m1: 0.5, m2: 0.3 });

  // Output JPEG qualité 90 pour Vision API
  const processed = await pipeline.jpeg({ quality: 90 }).toBuffer();

  return { buffer: processed, mimeType: "image/jpeg" };
}

/**
 * Version binarisée pour réessayer quand la version couleur échoue
 */
export async function preprocessForVisionBinary(
  imageBase64: string
): Promise<PreprocessResult> {
  const raw = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const input = Buffer.from(raw, "base64");

  const meta = await sharp(input).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;

  let pipeline = sharp(input);

  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: w > h ? MAX_DIMENSION : undefined,
      height: h >= w ? MAX_DIMENSION : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Binarisation agressive pour écriture manuscrite
  pipeline = pipeline.grayscale();
  pipeline = pipeline.normalize();
  pipeline = pipeline.sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 });
  pipeline = pipeline.threshold(128);

  const processed = await pipeline.png({ quality: 95 }).toBuffer();

  return { buffer: processed, mimeType: "image/png" };
}

/**
 * Analyse la qualité d'image avant envoi
 */
export async function analyzeImageQuality(
  imageBase64: string
): Promise<{
  score: number;
  issues: string[];
  suggestion: string;
}> {
  const raw = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const input = Buffer.from(raw, "base64");
  const issues: string[] = [];

  const meta = await sharp(input).metadata();
  const stats = await sharp(input).stats();

  const w = meta.width || 0;
  const h = meta.height || 0;

  // 1. Vérifier la résolution
  const megapixels = (w * h) / 1_000_000;
  if (megapixels < 0.5) {
    issues.push("Résolution trop faible");
  }

  // 2. Vérifier le contraste (écart-type des canaux)
  const channelStd = stats.channels[0]?.stdev || 0;
  if (channelStd < 20) {
    issues.push("Contraste faible");
  }
  if (channelStd > 100) {
    issues.push("Contraste excessif");
  }

  // 3. Vérifier la luminosité moyenne
  const meanBrightness = stats.channels[0]?.mean || 128;
  if (meanBrightness < 80) {
    issues.push("Image trop sombre");
  }
  if (meanBrightness > 220) {
    issues.push("Image trop claire (sur-exposée)");
  }

  // 4. Vérifier l'orientation
  if (h > w * 2) {
    issues.push("Image trop allongée verticalement");
  }

  // Score de 0 à 100
  let score = 100;
  if (issues.length >= 3) score -= 40;
  else if (issues.length >= 2) score -= 25;
  else if (issues.length === 1) score -= 15;

  // Bonus résolution
  if (megapixels >= 2) score += 5;

  score = Math.max(0, Math.min(100, score));

  // Suggestion
  let suggestion = "";
  if (score < 40) {
    suggestion = "Reprends la photo en mieux lumière, à plat sur le cahier";
  } else if (score < 60) {
    suggestion = "Essaie d'améliorer l'éclairage ou la position";
  } else if (score < 80) {
    suggestion = "Qualité acceptable, vérifie le cadrage";
  } else {
    suggestion = "Bonne qualité, prêt pour l'OCR";
  }

  return { score, issues, suggestion };
}
