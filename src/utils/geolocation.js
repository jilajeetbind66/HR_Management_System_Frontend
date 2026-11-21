/**
 * Helper to fetch current browser GPS coordinates asynchronously
 * With automatic fallback from high-accuracy satellite to standard Wi-Fi/IP location on PCs/laptops
 */
export const getCurrentPositionAsync = (customOptions = {}) => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    const defaultOptions = {
      timeout: 10000,
      enableHighAccuracy: true,
      maximumAge: 30000,
      ...customOptions,
    };

    const tryFetchPosition = (opts, isRetry = false) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          // If high accuracy times out (3) or is unavailable (2) on PC/laptop without GPS chip, retry with standard Wi-Fi/IP location
          if (!isRetry && (err.code === 3 || err.code === 2) && opts.enableHighAccuracy) {
            tryFetchPosition({ timeout: 8000, enableHighAccuracy: false, maximumAge: 60000 }, true);
            return;
          }

          let message = 'Location access is required to verify office boundary.';
          if (err.code === 1) {
            message = 'Location permission was denied. Please allow location access in your browser address bar.';
          } else if (err.code === 2) {
            message = 'Location unavailable. You can enter Latitude & Longitude manually from Google Maps.';
          } else if (err.code === 3) {
            message = 'GPS request timed out. You can paste Latitude & Longitude directly from Google Maps.';
          }
          const error = new Error(message);
          error.code = err.code;
          reject(error);
        },
        opts
      );
    };

    tryFetchPosition(defaultOptions);
  });
};
