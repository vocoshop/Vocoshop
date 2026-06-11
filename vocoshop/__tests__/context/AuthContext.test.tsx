import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, AuthContext } from '../../src/api/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../../src/api/api';

jest.mock('../../src/api/api');
const mockAPI = API as jest.Mocked<typeof API>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  describe('Initial State', () => {
    it('should have loading true initially', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      expect(result.current.loading).toBe(true);
    });

    it('should have no user initially', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {});

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.storeId).toBeNull();
    });
  });

  describe('applySession', () => {
    it('should set token and storeId', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.applySession({
          token: 'test-token-123',
          storeId: 'store-456',
          user: { name: 'Test User' },
          storeType: 'shop',
          isOnboarded: true,
        });
      });

      expect(result.current.token).toBe('test-token-123');
      expect(result.current.storeId).toBe('store-456');
      expect(result.current.user).toEqual({ name: 'Test User' });
      expect(result.current.storeType).toBe('shop');
    });

    it('should throw error when token is missing', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.applySession({
            token: '',
            storeId: 'store-123',
          });
        })
      ).rejects.toThrow('token/storeId manquant');
    });

    it('should throw error when storeId is missing', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.applySession({
            token: 'token-123',
            storeId: '',
          });
        })
      ).rejects.toThrow('token/storeId manquant');
    });
  });

  describe('getAuthHeaders', () => {
    it('should return empty authorization when no token', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {});

      const headers = result.current.getAuthHeaders();
      expect(headers.Authorization).toBe('');
      expect(headers['x-store-id']).toBeUndefined();
    });

    it('should return headers with token and storeId', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.applySession({
          token: 'Bearer-token',
          storeId: 'my-store',
        });
      });

      const headers = result.current.getAuthHeaders();
      expect(headers.Authorization).toBe('Bearer Bearer-token');
      expect(headers['x-store-id']).toBe('my-store');
    });
  });

  describe('logout', () => {
    it('should clear all auth data', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.applySession({
          token: 'test-token',
          storeId: 'test-store',
          user: { name: 'User' },
        });
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.token).toBeNull();
      expect(result.current.storeId).toBeNull();
      expect(result.current.user).toBeNull();
    });

    it('should clear inventory state on logout', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setInventoryActive(true);
        result.current.setInventoryCount(5);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.inventoryActive).toBe(false);
      expect(result.current.inventoryCount).toBe(0);
    });
  });

  describe('Inventory State', () => {
    it('should update inventoryActive', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setInventoryActive(true);
      });

      expect(result.current.inventoryActive).toBe(true);
    });

    it('should update inventoryCount', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setInventoryCount(10);
      });

      expect(result.current.inventoryCount).toBe(10);
    });

    it('should update inventorySessionId', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setInventorySessionId('session-123');
      });

      expect(result.current.inventorySessionId).toBe('session-123');
    });

    it('should update storeType', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.setStoreType('supermarket');
      });

      expect(result.current.storeType).toBe('supermarket');
    });
  });

  describe('requestOTP', () => {
    it('should return true on successful OTP request', async () => {
      mockAPI.post.mockResolvedValueOnce({ data: {}, status: 200, statusText: "OK", headers: {}, config: {} as any });

      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.requestOTP('+2250700000000');

      expect(response).toBe(true);
      expect(mockAPI.post).toHaveBeenCalledWith('/otp/send', { phone: '+2250700000000' });
    });

    it('should return false on OTP request failure', async () => {
      mockAPI.post.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.requestOTP('+2250700000000');

      expect(response).toBe(false);
    });
  });

  describe('verifyOTP', () => {
    it('should return true and apply session on successful verification', async () => {
      mockAPI.post.mockResolvedValueOnce({
        data: {
          token: 'verified-token',
          storeId: 'verified-store',
          user: { name: 'Verified User' },
          storeType: 'shop',
          isOnboarded: true,
        },
        status: 200, statusText: "OK", headers: {}, config: {} as any,
      });

      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.verifyOTP('+2250700000000', '123456');
      });

      await waitFor(() => {
        expect(result.current.token).toBe('verified-token');
      });
    });

    it('should return false on verification failure', async () => {
      mockAPI.post.mockRejectedValueOnce({ response: { status: 401, data: {} } });

      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.verifyOTP('+2250700000000', '000000');

      expect(response).toBe(false);
    });
  });

  describe('isReady', () => {
    it('should be false while loading', () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      expect(result.current.isReady).toBe(false);
    });

    it('should be true after loading completes', async () => {
      const { result } = renderHook(() => React.useContext(AuthContext), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {});

      expect(result.current.isReady).toBe(true);
    });
  });
});