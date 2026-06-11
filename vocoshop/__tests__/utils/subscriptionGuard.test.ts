import { setSubscriptionHandler, triggerSubscriptionGuard } from '../../src/api/utils/subscriptionGuard';

describe('subscriptionGuard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setSubscriptionHandler', () => {
    it('should set the handler function', () => {
      const handler = jest.fn();
      setSubscriptionHandler(handler);
      
      triggerSubscriptionGuard();
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('triggerSubscriptionGuard', () => {
    it('should call the handler with data', () => {
      const handler = jest.fn();
      setSubscriptionHandler(handler);
      
      triggerSubscriptionGuard({ plan: 'premium' });
      
      expect(handler).toHaveBeenCalledWith({ plan: 'premium' });
    });

    it('should not throw if no handler is set', () => {
      expect(() => {
        triggerSubscriptionGuard();
      }).not.toThrow();
    });

    it('should not call handler after it is cleared', () => {
      const handler = jest.fn();
      setSubscriptionHandler(handler);
      setSubscriptionHandler(null as any);
      
      triggerSubscriptionGuard();
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
});