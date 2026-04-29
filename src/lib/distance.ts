const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

export function formatDistance(distanceKm: number): string {
  const meters = distanceKm * 1000
  if (meters < 1000) {
    return `в ${Math.round(meters / 10) * 10} м`
  }
  return `в ${distanceKm.toFixed(1)} км`
}

/** «1.5 км от вас» / «600 м от вас» — для карточки заведения. */
export function formatDistanceFromUser(distanceKm: number): string {
  const meters = distanceKm * 1000
  if (meters < 1000) {
    return `${Math.round(meters / 10) * 10} м от вас`
  }
  return `${distanceKm.toFixed(1)} км от вас`
}
