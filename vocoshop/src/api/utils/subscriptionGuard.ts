let handler: ((data?: any) => void) | null = null;

export const setSubscriptionHandler = (fn: (data?: any) => void) => {
handler = fn;
};

export const triggerSubscriptionGuard = (data?: any) => {
if (handler) handler(data);
};
