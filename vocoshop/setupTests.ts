jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}), { virtual: true });

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-application', () => ({
  getIosIdForVendorAsync: jest.fn(),
  androidId: 'test-android-id',
}), { virtual: true });

jest.mock('expo-constants', () => ({
  default: {
    installationId: 'test-installation-id',
  },
}), { virtual: true });

jest.mock('expo-camera', () => ({
  Camera: 'Camera',
  CameraType: { back: 'back', front: 'front' },
}));

jest.mock('expo-barcode-scanner', () => ({
  BarCodeScanner: 'BarCodeScanner',
}));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  },
}));

global.fetch = jest.fn();

const originalError = console.error;
const originalWarn = console.warn;

let isFiltering = false;

console.error = (...args: any[]) => {
  if (isFiltering) return;
  if (
    typeof args[0] === 'string' &&
    args[0].includes('An update to') &&
    args[0].includes('was not wrapped in act')
  ) {
    return;
  }
  originalError.call(console, ...args);
};

console.warn = (...args: any[]) => {
  if (isFiltering) return;
  if (
    typeof args[0] === 'string' &&
    args[0].includes('An update to') &&
    args[0].includes('was not wrapped in act')
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};