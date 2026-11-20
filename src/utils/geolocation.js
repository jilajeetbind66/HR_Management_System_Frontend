/**
 * Helper to fetch current browser GPS coordinates asynchronously
 */
export const getCurrentPositionAsync = (options = { timeout: 8000, enableHighAccuracy: true, maximumAge: 30000 }) => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        let message = 'Location access is required to verify office presence.';
        if (err.code === 1) {
          message = 'Location permission was denied. Please allow location access in browser settings to punch attendance.';
        } else if (err.code === 2) {
          message = 'Location unavailable. Please make sure device location/GPS is turned on.';
        } else if (err.code === 3) {
          message = 'GPS request timed out. Please click Punch again.';
        }
        const error = new Error(message);
        error.code = err.code;
        reject(error);
      },
      options
    );
  });
};
