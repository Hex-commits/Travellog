from collections.abc import Callable, Iterable
from dataclasses import dataclass

from shapely.geometry import MultiPolygon, Point, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from site_builder.district_lookup import City, District
from site_builder.library import LibraryPhoto

FindDistrict = Callable[[float, float], District | None]


@dataclass(frozen=True, eq=False)
class Area:
    id: str
    cities: tuple[City, ...]
    boundary: BaseGeometry
    label_point: tuple[float, float]
    photo_ids: tuple[str, ...]

    @property
    def name(self) -> str:
        return " · ".join(city.name for city in self.cities)

    @property
    def name_ja(self) -> str | None:
        japanese_names = [city.name_ja for city in self.cities if city.name_ja]
        return " · ".join(japanese_names) or None


def group_into_areas(photos: Iterable[LibraryPhoto], find_district: FindDistrict) -> list[Area]:
    """Group located photos by district and merge districts that belong to the same city.

    Args:
        photos: Photos in chronological order.
        find_district: Returns the ward or city containing a point, or None.

    Returns:
        Areas ordered by the first photo taken in them.
    """
    districts: dict[str, District] = {}
    photo_ids_by_district: dict[str, list[str]] = {}
    for photo in photos:
        if not photo.metadata.has_location:
            continue
        district = find_district(photo.metadata.latitude, photo.metadata.longitude)
        if district is None:
            continue
        districts.setdefault(district.id, district)
        photo_ids_by_district.setdefault(district.id, []).append(photo.id)
    shapes = {district_id: _shape_of(district) for district_id, district in districts.items()}
    district_groups = _group_by_city(list(districts.values()))
    return [_build_area(group, shapes, photo_ids_by_district) for group in district_groups]


def _shape_of(district: District) -> BaseGeometry:
    polygons = [Polygon(rings[0], rings[1:]) for rings in district.polygons]
    return MultiPolygon(polygons).buffer(0)


def _group_by_city(districts: list[District]) -> list[list[District]]:
    groups: dict[str, list[District]] = {}
    for district in districts:
        groups.setdefault(district.city.id, []).append(district)
    return list(groups.values())


def _build_area(
    districts: list[District],
    shapes: dict[str, BaseGeometry],
    photo_ids_by_district: dict[str, list[str]],
) -> Area:
    photo_count_by_city: dict[str, int] = {}
    cities: dict[str, City] = {}
    for district in districts:
        cities[district.city.id] = district.city
        photo_count_by_city[district.city.id] = (
            photo_count_by_city.get(district.city.id, 0) + len(photo_ids_by_district[district.id])
        )
    ordered_cities = tuple(sorted(cities.values(), key=lambda city: -photo_count_by_city[city.id]))
    boundary = unary_union([shapes[district.id] for district in districts])
    return Area(
        id=districts[0].id,
        cities=ordered_cities,
        boundary=boundary,
        label_point=_label_point(boundary, ordered_cities[0]),
        photo_ids=tuple(photo_id for district in districts for photo_id in photo_ids_by_district[district.id]),
    )


def _label_point(boundary: BaseGeometry, main_city: City) -> tuple[float, float]:
    city_center = Point(main_city.longitude, main_city.latitude)
    anchor = city_center if boundary.contains(city_center) else boundary.representative_point()
    return anchor.y, anchor.x
