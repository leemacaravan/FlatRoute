const ERROR_MESSAGES = {
  [GeolocationPositionError.PERMISSION_DENIED]: 'Location access denied. Enable it in your browser settings.',
  [GeolocationPositionError.POSITION_UNAVAILABLE]: "Location unavailable. Check your device's GPS.",
  [GeolocationPositionError.TIMEOUT]: 'Location request timed out. Try again.',
}

export function watchLocation(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError('Geolocation is not supported by this browser.')
    return () => {}
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        heading: pos.coords.heading,
        accuracy: pos.coords.accuracy,
      })
    },
    (err) => {
      onError(ERROR_MESSAGES[err.code] ?? 'Could not get your location.')
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  )

  return () => navigator.geolocation.clearWatch(id)
}
