import * as ImageManipulator from "expo-image-manipulator";

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.6;

export async function compressImage(uri: string): Promise<{ uri: string; base64: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return { uri: result.uri, base64: result.base64 || "" };
}

export async function checkImageQuality(base64: string): Promise<{ isSharp: boolean; warning?: string }> {
  const raw = base64.replace(/^data:image\/\w+;base64,/, "");
  const sizeBytes = (raw.length * 3) / 4;
  const sizeKB = sizeBytes / 1024;

  if (sizeKB < 20) {
    return { isSharp: false, warning: "Image trop petite, risque d'être floue" };
  }

  return { isSharp: true };
}
