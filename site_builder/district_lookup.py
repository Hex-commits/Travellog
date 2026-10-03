import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "TravelJapan2026-site-builder/1.0 (personal travel photo map)"
DISTRICT_ZOOM_LEVEL = 12
CITY_ZOOM_LEVEL = 10
WARD_ADMIN_LEVEL = "8"
BOUNDARY_SIMPLIFICATION_DEGREES = 0.0005
REQUEST_TIMEOUT_SECONDS = 60
SECONDS_BETWEEN_REQUESTS = 1.1
CACHE_FORMAT_VERSION = 2
TOKYO_PREFECTURE_CODE = "JP-13"
TOKYO_SPECIAL_WARD_SUFFIX = "区"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class City:
    id: str
    name: str
    name_ja: str | None
    latitude: float
    longitude: float


@dataclass(frozen=True, eq=False)
class District:
    id: str
    name: str
    city: City
    polygons: list


TOKYO = City(id="tokyo-special-wards", name="Tokyo", name_ja="東京", latitude=35.6812, longitude=139.7671)


class DistrictLookupError(Exception):
    pass


class DistrictLookup:
    def __init__(self, cache_path: Path) -> None:
        """Create a district lookup that remembers known boundaries on disk.

        Args:
            cache_path: JSON file holding the districts and cities found so far.
        """
        self._cache_path = cache_path
        self._cities: dict[str, City] = {}
        self._districts: dict[str, District] = {}
        self._last_request_at = 0.0
        self._load_cache()

    def district_at(self, latitude: float, longitude: float) -> District | None:
        """Find the ward, or the whole city where there are no wards, that contains a point.

        Args:
            latitude: Latitude in degrees.
            longitude: Longitude in degrees.

        Returns:
            The district with its city, or None when the point lies outside every city.

        Raises:
            DistrictLookupError: OpenStreetMap could not be reached or answered with an error.
        """
        for district in self._districts.values():
            if _inside_any_polygon(latitude, longitude, district.polygons):
                return district
        place = self._reverse_geocode(latitude, longitude, DISTRICT_ZOOM_LEVEL)
        polygons = _polygons_of(place.get("geojson", {}))
        if not _is_administrative_boundary(place) or not polygons:
            return None
        district = District(
            id=_place_id(place),
            name=place.get("name") or _place_id(place),
            city=self._city_of(place, latitude, longitude),
            polygons=polygons,
        )
        if district.city.id not in self._cities:
            logger.info("  Found %s (%s)", district.city.name, district.city.name_ja or "-")
        self._cities[district.city.id] = district.city
        self._districts[district.id] = district
        self._save_cache()
        return district

    def _city_of(self, place: dict, latitude: float, longitude: float) -> City:
        local_name = place.get("namedetails", {}).get("name")
        if _is_tokyo_special_ward(place, local_name):
            return TOKYO
        if place.get("extratags", {}).get("admin_level") != WARD_ADMIN_LEVEL:
            return _city_from_place(place)
        city_name = place.get("address", {}).get("city")
        known_city = next((city for city in self._cities.values() if city.name == city_name), None)
        if known_city:
            return known_city
        city_place = self._reverse_geocode(latitude, longitude, CITY_ZOOM_LEVEL)
        return _city_from_place(city_place) if _is_administrative_boundary(city_place) else _city_from_place(place)

    def _reverse_geocode(self, latitude: float, longitude: float, zoom: int) -> dict:
        query = urllib.parse.urlencode(
            {
                "lat": f"{latitude:.6f}",
                "lon": f"{longitude:.6f}",
                "zoom": zoom,
                "format": "jsonv2",
                "addressdetails": 1,
                "extratags": 1,
                "namedetails": 1,
                "polygon_geojson": 1,
                "polygon_threshold": BOUNDARY_SIMPLIFICATION_DEGREES,
            }
        )
        request = urllib.request.Request(
            f"{NOMINATIM_REVERSE_URL}?{query}",
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
        )
        time.sleep(max(0.0, self._last_request_at + SECONDS_BETWEEN_REQUESTS - time.monotonic()))
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                place = json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            raise DistrictLookupError(f"OpenStreetMap district lookup failed: {error}") from error
        finally:
            self._last_request_at = time.monotonic()
        if not isinstance(place, dict) or "error" in place:
            return {}
        return place

    def _load_cache(self) -> None:
        try:
            cache = json.loads(self._cache_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        if not isinstance(cache, dict) or cache.get("version") != CACHE_FORMAT_VERSION:
            return
        for entry in cache.get("cities", []):
            self._cities[entry["id"]] = City(**entry)
        for entry in cache.get("districts", []):
            self._districts[entry["id"]] = District(
                id=entry["id"],
                name=entry["name"],
                city=self._cities[entry["cityId"]],
                polygons=entry["polygons"],
            )

    def _save_cache(self) -> None:
        cache = {
            "version": CACHE_FORMAT_VERSION,
            "cities": [vars(city) for city in self._cities.values()],
            "districts": [
                {"id": district.id, "name": district.name, "cityId": district.city.id, "polygons": district.polygons}
                for district in self._districts.values()
            ],
        }
        self._cache_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self._cache_path.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        temporary_path.replace(self._cache_path)


def _is_administrative_boundary(place: dict) -> bool:
    return place.get("category") == "boundary" and place.get("type") == "administrative"


def _place_id(place: dict) -> str:
    return place.get("extratags", {}).get("wikidata") or f"osm-{place.get('osm_type')}-{place.get('osm_id')}"


def _city_from_place(place: dict) -> City:
    local_name = place.get("namedetails", {}).get("name")
    place_id = _place_id(place)
    return City(
        id=place_id,
        name=place.get("name") or local_name or place_id,
        name_ja=local_name,
        latitude=float(place["lat"]),
        longitude=float(place["lon"]),
    )


def _is_tokyo_special_ward(place: dict, local_name: str | None) -> bool:
    prefecture_code = place.get("address", {}).get("ISO3166-2-lvl4")
    return prefecture_code == TOKYO_PREFECTURE_CODE and bool(local_name) and local_name.endswith(TOKYO_SPECIAL_WARD_SUFFIX)


def _polygons_of(geometry: dict) -> list:
    if geometry.get("type") == "Polygon":
        return [geometry["coordinates"]]
    if geometry.get("type") == "MultiPolygon":
        return geometry["coordinates"]
    return []


def _inside_any_polygon(latitude: float, longitude: float, polygons: list) -> bool:
    for outer_ring, *holes in polygons:
        if _inside_ring(latitude, longitude, outer_ring) and not any(
            _inside_ring(latitude, longitude, hole) for hole in holes
        ):
            return True
    return False


def _inside_ring(latitude: float, longitude: float, ring: list) -> bool:
    inside = False
    previous_longitude, previous_latitude = ring[-1]
    for current_longitude, current_latitude in ring:
        crosses_latitude = (current_latitude > latitude) != (previous_latitude > latitude)
        if crosses_latitude:
            crossing_longitude = current_longitude + (latitude - current_latitude) * (
                previous_longitude - current_longitude
            ) / (previous_latitude - current_latitude)
            if longitude < crossing_longitude:
                inside = not inside
        previous_longitude, previous_latitude = current_longitude, current_latitude
    return inside
