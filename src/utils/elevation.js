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

// ORS occasionally returns coordinates with null or missing elevation.
// Returns a new coords array with those gaps filled by linear interpolation
// between the nearest valid neighbors (or 0 if none exist).
function fillElevation(coords) {
  const filled = coords.map((c) => [...c]) // shallow copy each coord
  let nullCount = 0

  // Forward-fill pass: set each null elev to nearest preceding valid elev
  let lastValid = null
  for (const c of filled) {
    if (c[2] != null && isFinite(c[2])) {
      lastValid = c[2]
    } else {
      nullCount++
      c[2] = lastValid ?? 0
    }
  }

  if (nullCount > 0) {
    console.warn(
      `[elevation] ${nullCount} coordinate(s) had null/missing elevation — filled with nearest valid value.`
    )
  }

  return filled
}

// Returns an array of grade values (%) for each consecutive pair of coordinates.
// coords: Array of [lon, lat, elevation_m] from ORS elevation-enabled response.
// Grade = rise / run * 100. Negative = downhill.
export function computeGrades(coords) {
  const safe = fillElevation(coords)
  const grades = []
  for (let i = 0; i < safe.length - 1; i++) {
    const dist = horizontalDistance(safe[i], safe[i + 1])
    const rise = safe[i + 1][2] - safe[i][2]
    const grade = dist > 0 ? (rise / dist) * 100 : 0
    grades.push(isFinite(grade) ? grade : 0)
  }
  return grades
}

// Returns total elevation gain in metres (sum of positive rises only).
export function totalElevationGain(coords) {
  const safe = fillElevation(coords)
  let gain = 0
  for (let i = 1; i < safe.length; i++) {
    const rise = safe[i][2] - safe[i - 1][2]
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
  const safe = fillElevation(coords)
  const points = []
  let cumDist = 0
  points.push({ dist: 0, elev: safe[0][2], grade: 0, lon: safe[0][0], lat: safe[0][1] })
  for (let i = 1; i < safe.length; i++) {
    cumDist += horizontalDistance(safe[i - 1], safe[i])
    points.push({
      dist: cumDist,
      elev: safe[i][2],
      grade: grades[i - 1] ?? 0,
      lon: safe[i][0],
      lat: safe[i][1],
    })
  }
  return points
}
