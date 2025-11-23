
export const Haptic = {
  tap: () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); },
  light: () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5); },
  success: () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([10, 30, 10]); },
  error: () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50, 50]); }
};
