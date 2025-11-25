
export const generateUUID = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Fallback if crypto is blocked
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};
