import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("../../src/api/api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock("../../src/api/ocr/../utils/network", () => ({
  isOnline: jest.fn(() => true),
  onNetworkChange: jest.fn(() => jest.fn()),
}));

import {
  enqueueOcrScan,
  getOcrQueueStats,
  syncPendingScans,
} from "../../src/api/ocr/ocrOfflineQueue";
import { isOnline } from "../../src/api/utils/network";

const mockPost = jest.requireMock("../../src/api/api").default.post as jest.Mock;

describe("offline/ocrOfflineQueue", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (isOnline as jest.Mock).mockReturnValue(true);
    mockPost.mockResolvedValue({ data: { _id: "scan-test", globalConfidence: 0.9 } });
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it("isole les scans en attente par boutique", async () => {
    await AsyncStorage.setItem("storeId", "store-a");
    await enqueueOcrScan(["image-a"]);

    await AsyncStorage.setItem("storeId", "store-b");
    expect((await getOcrQueueStats()).total).toBe(0);
    await enqueueOcrScan(["image-b"]);

    await AsyncStorage.setItem("storeId", "store-a");
    expect((await getOcrQueueStats()).total).toBe(1);
  });

  it("synchronise uniquement la file de la boutique active", async () => {
    await AsyncStorage.setItem("storeId", "store-a");
    await enqueueOcrScan(["image-a"]);

    await AsyncStorage.setItem("storeId", "store-b");
    await enqueueOcrScan(["image-b"]);
    expect((await getOcrQueueStats()).pending).toBe(1);
    const result = await syncPendingScans();

    expect(result.failed).toBe(0);
    expect(result.synced).toBe(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/ocr/scan", expect.objectContaining({
      images: ["data:image/jpeg;base64,image-b"],
    }));

    await AsyncStorage.setItem("storeId", "store-a");
    expect((await getOcrQueueStats()).total).toBe(1);
    await AsyncStorage.setItem("storeId", "store-b");
    expect((await getOcrQueueStats()).total).toBe(0);
  });
});
