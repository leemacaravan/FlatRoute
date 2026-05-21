const EARTH_RADIUS_M = 6_371_000

function toRad(deg) {
  return deg * (Math.PI / 180)
}

// Haversine horizontal distance in metres between two coordinate pairs.
// Accepts [lon, lat] or [lon, lat, elev] — elevation is ignored.
function horizontalDistance([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Returns an array of grade values (%) for each consecutive pair of coordinates.
// coords: Array of [lon, lat, elevation_m] from ORS elevation-enabled response.
// Grade = rise / run * 100. Negative = downhill.
export function computeGrades(coords) {
  const grades = []
  for (let i = 0; i < coords.length - 1; i++) {
    const dist = horizontalDistance(coords[i], coords[i + 1])
    const rise = coords[i + 1][2] - coords[i][2]
    grades.push(dist > 0 ? (rise / dist) * 100 : 0)
  }
  return grades
}

// Returns total elevation gain in metres (sum of positive rises only).
export function totalElevationGain(coords) {
  let gain = 0
  for (let i = 1; i < coords.length; i++) {
    const rise = coords[i][2] - coords[i - 1][2]
    if (rise > 0) gain += rise
  }
  return gain
}

const STEEP_THRESHOLDS = { driving: 15, cycling: 8, walking: 12 }

// Returns true if any segment meets or exceeds the mode's warning threshold.
export function hasSteepWarning(grades, mode) {
  const threshold = STEEP_THRESHOLDS[mode] ?? 15
  return grades.some((g) => Math.abs(g) >= threshold)
}

// Returns the maximum absolute grade across all segments.
export function maxGrade(grades) {
  if (grades.length === 0) return 0
  return Math.max(...grades.map(Math.abs))
}

// Builds chart-friendly data: one point per coordinate with cumulative distance.
// Returns [{dist, elev, grade, lon, lat}] where dist is metres from start.
export function buildChartData(coords, grades) {
  if (!coords.length) return []
  const points = []
  let cumDist = 0
  points.push({ dist: 0, elev: coords[0][2], grade: 0, lon: coords[0][0], lat: coords[0][1] })
  for (let i = 1; i < coords.length; i++) {
    cumDist += horizontalDistance(coords[i - 1], coords[i])
    points.push({
      dist: cumDist,
      elev: coords[i][2],
      grade: grades[i - 1] ?? 0,
      lon: coords[i][0],
      lat: coords[i][1],
    })
  }
  return points
}
