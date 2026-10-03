import math

EARTH_RADIUS_KM = 6371.0


def distance_km(from_latitude: float, from_longitude: float, to_latitude: float, to_longitude: float) -> float:
    """Measure the great-circle distance between two points.

    Args:
        from_latitude: Latitude of the first point in degrees.
        from_longitude: Longitude of the first point in degrees.
        to_latitude: Latitude of the second point in degrees.
        to_longitude: Longitude of the second point in degrees.

    Returns:
        Distance in kilometres.
    """
    latitude_delta = math.radians(to_latitude - from_latitude)
    longitude_delta = math.radians(to_longitude - from_longitude)
    haversine = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(math.radians(from_latitude)) * math.cos(math.radians(to_latitude)) * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(haversine))
