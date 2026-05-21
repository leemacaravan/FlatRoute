// Extracts turn-by-turn steps from an ORS GeoJSON Feature.
// Each step in feature.properties.segments[].steps[] carries:
//   instruction (string), distance (m), duration (s), type (int), way_points ([start, end] indices).
// We resolve way_points[0] into the actual coordinate so callers never need the raw feature.
export function extractSteps(feature) {
  const coords = feature.geometry.coordinates
  const segments = feature.properties?.segments ?? []
  const steps = []
  for (const seg of segments) {
    for (const step of seg.steps ?? []) {
      const idx = step.way_points?.[0] ?? 0
      const [lon, lat] = coords[idx]
      steps.push({
        instruction: step.instruction ?? '',
        distance: step.distance ?? 0,
        duration: step.duration ?? 0,
        type: step.type ?? 6,
        coord: [lon, lat],
      })
    }
  }
  return steps
}
