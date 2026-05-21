// Returns a MapLibre style URL.
// If VITE_TILE_KEY is set, routes through Stadia Maps (outdoors style, great for navigation).
// Falls back to OpenFreeMap — free, no key, OSM-based.
export function getTileStyle() {
  const key = import.meta.env.VITE_TILE_KEY
  if (key) {
    return `https://tiles.stadiamaps.com/styles/outdoors.json?api_key=${key}`
  }
  return 'https://tiles.openfreemap.org/styles/liberty'
}
