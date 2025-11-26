
export const generateUUID = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (error) {
    // Fallback if crypto is blocked
    console.warn('crypto.randomUUID unavailable', error);
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};
