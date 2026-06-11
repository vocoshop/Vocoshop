import {
  setForceOffline,
  getForceOffline,
  isOnline,
  isOffline,
  onNetworkChange,
} from '../../src/api/utils/network';

describe('network utility', () => {
  beforeEach(() => {
    setForceOffline(null);
  });

  describe('setForceOffline / getForceOffline', () => {
    it('should set and get forced offline state', () => {
      setForceOffline(true);
      expect(getForceOffline()).toBe(true);
    });

    it('should set forced online state', () => {
      setForceOffline(false);
      expect(getForceOffline()).toBe(false);
    });

    it('should reset to null', () => {
      setForceOffline(true);
      setForceOffline(null);
      expect(getForceOffline()).toBeNull();
    });
  });

  describe('isOnline', () => {
    it('should return true when not forced offline', () => {
      setForceOffline(null);
      expect(isOnline()).toBe(true);
    });

    it('should return false when forced offline', () => {
      setForceOffline(true);
      expect(isOnline()).toBe(false);
    });

    it('should return true when forced online', () => {
      setForceOffline(false);
      expect(isOnline()).toBe(true);
    });
  });

  describe('isOffline', () => {
    it('should return false when not forced offline', () => {
      setForceOffline(null);
      expect(isOffline()).toBe(false);
    });

    it('should return true when forced offline', () => {
      setForceOffline(true);
      expect(isOffline()).toBe(true);
    });

    it('should return false when forced online', () => {
      setForceOffline(false);
      expect(isOffline()).toBe(false);
    });
  });

  describe('onNetworkChange', () => {
    it('should call callback immediately with current state', () => {
      const callback = jest.fn();
      onNetworkChange(callback);
      
      expect(callback).toHaveBeenCalledWith({
        online: true,
        isConnected: true,
        isInternetReachable: true,
        forcedOffline: null,
      });
    });

    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = onNetworkChange(callback);
      
      unsubscribe();
      
      setForceOffline(true);
      expect(callback).not.toHaveBeenCalledTimes(2);
    });

    it('should notify on force offline change', () => {
      const callback = jest.fn();
      onNetworkChange(callback);
      
      setForceOffline(true);
      
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          online: false,
          forcedOffline: true,
        })
      );
    });
  });
});