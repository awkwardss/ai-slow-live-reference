export const DEFAULT_LOCATION_MAX_AGE_MS = 120_000;
export const DEFAULT_LOCATION_FUTURE_TOLERANCE_MS = 30_000;

function boundedNumber(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

export function normalizeLocation(value) {
  if (!value || typeof value !== "object") return null;

  const latitude = boundedNumber(value.latitude, -90, 90);
  const longitude = boundedNumber(value.longitude, -180, 180);
  const accuracy = boundedNumber(value.accuracy, 0, 100_000);
  const capturedAt = boundedNumber(value.capturedAt, 1, 9_999_999_999_999);
  if (latitude === null || longitude === null || accuracy === null || capturedAt === null) {
    return null;
  }

  const speed = value.speed === null || value.speed === undefined || value.speed === ""
    ? null
    : boundedNumber(value.speed, 0, 150);
  const heading = value.heading === null || value.heading === undefined || value.heading === ""
    ? null
    : boundedNumber(value.heading, 0, 360);
  if (value.speed !== null && value.speed !== undefined && value.speed !== "" && speed === null) {
    return null;
  }
  if (value.heading !== null && value.heading !== undefined && value.heading !== "" && heading === null) {
    return null;
  }

  return { latitude, longitude, accuracy, capturedAt, speed, heading };
}

export function freshLocation(
  value,
  {
    now = Date.now(),
    maxAgeMs = DEFAULT_LOCATION_MAX_AGE_MS,
    futureToleranceMs = DEFAULT_LOCATION_FUTURE_TOLERANCE_MS,
  } = {},
) {
  const location = normalizeLocation(value);
  if (!location) return null;
  if (now - location.capturedAt > maxAgeMs) return null;
  if (location.capturedAt - now > futureToleranceMs) return null;
  return location;
}

export function locationSummary(value, options = {}) {
  const location = freshLocation(value, options);
  if (!location) return null;

  return {
    latitude: Number(location.latitude.toFixed(6)),
    longitude: Number(location.longitude.toFixed(6)),
    accuracyMeters: Math.max(1, Math.round(location.accuracy)),
    capturedAt: new Date(location.capturedAt).toISOString(),
    speedKilometersPerHour: location.speed === null
      ? null
      : Number((location.speed * 3.6).toFixed(1)),
    headingDegrees: location.heading === null ? null : Math.round(location.heading),
  };
}
