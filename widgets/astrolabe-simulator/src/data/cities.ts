/** Preset city latitudes/longitudes for the location picker (PLAN §11). */

export interface City {
  name: string;
  lat: number;
  lng: number;
}

export const CITIES: City[] = [
  { name: 'Reykjavík', lat: 64.1466, lng: -21.9426 },
  { name: 'Oslo', lat: 59.9139, lng: 10.7522 },
  { name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Pittsburgh', lat: 40.4406, lng: -79.9959 },
  { name: 'Toledo', lat: 39.8628, lng: -4.0273 },
  { name: 'Athens', lat: 37.9838, lng: 23.7275 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Baghdad', lat: 33.3152, lng: 44.3661 },
  { name: 'Alexandria', lat: 31.2001, lng: 29.9187 },
  { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
];
