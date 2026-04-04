export const ALL_LOCATIONS_FILTER = '__all_locations__'
export const LEGACY_ALL_LOCATIONS_FILTER = 'All'
export const NO_LOCATION_FILTER = '__no_location__'
export const NO_LOCATION_FILTER_LABEL = 'No location'

export function isAllLocationsFilter(location: string) {
  return !location || location === ALL_LOCATIONS_FILTER || location === LEGACY_ALL_LOCATIONS_FILTER
}

export function isNoLocationFilter(location: string) {
  return location === NO_LOCATION_FILTER
}
