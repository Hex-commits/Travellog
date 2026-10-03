import json
from dataclasses import dataclass
from pathlib import Path

import shapely
from shapely.geometry import LineString, mapping
from shapely.geometry.base import BaseGeometry

from site_builder.areas import Area
from site_builder.library import LibraryPhoto

COORDINATE_DECIMALS = 5
BOUNDARY_COORDINATE_DECIMALS = 4
BOUNDARY_DISPLAY_SIMPLIFICATION_DEGREES = 0.0008


@dataclass(frozen=True)
class AreaConnection:
    from_area_id: str
    to_area_id: str
    from_point: tuple[float, float]
    to_point: tuple[float, float]


@dataclass(frozen=True)
class TravelRoute:
    areas: list[Area]
    connections: list[AreaConnection]
    local_paths: list[tuple[str, ...]]


@dataclass
class _Visit:
    area: Area | None
    photos: list[LibraryPhoto]


def build_travel_route(photos: list[LibraryPhoto], areas: list[Area]) -> TravelRoute:
    """Connect the areas in the order they were visited, once per pair, and trace the routes between photos.

    Args:
        photos: Photos in chronological order.
        areas: Areas with their boundaries and photo ids.

    Returns:
        The areas, their connections and the local paths between photos.
    """
    visits = _group_into_visits(photos, areas)
    local_paths = [visit.photos for visit in visits if len(visit.photos) > 1]
    connections: dict[frozenset[str], AreaConnection] = {}
    for previous_visit, next_visit in zip(visits, visits[1:]):
        if previous_visit.area and next_visit.area:
            pair = frozenset({previous_visit.area.id, next_visit.area.id})
            if pair not in connections:
                connections[pair] = _connect(previous_visit.area, next_visit.area)
        else:
            local_paths.append([previous_visit.photos[-1], next_visit.photos[0]])
    return TravelRoute(
        areas=areas,
        connections=list(connections.values()),
        local_paths=[tuple(photo.id for photo in path) for path in local_paths],
    )


def write_route(route: TravelRoute, route_path: Path) -> None:
    """Save the travel route for the site.

    Args:
        route: Route to save.
        route_path: Path of the JSON file the site reads.
    """
    payload = {
        "areas": [
            {
                "id": area.id,
                "name": area.name,
                "nameJa": area.name_ja,
                "labelLatitude": round(area.label_point[0], COORDINATE_DECIMALS),
                "labelLongitude": round(area.label_point[1], COORDINATE_DECIMALS),
                "photoIds": list(area.photo_ids),
                "boundary": _display_boundary(area.boundary),
            }
            for area in route.areas
        ],
        "connections": [
            {
                "from": connection.from_area_id,
                "to": connection.to_area_id,
                "fromPoint": [round(value, COORDINATE_DECIMALS) for value in connection.from_point],
                "toPoint": [round(value, COORDINATE_DECIMALS) for value in connection.to_point],
            }
            for connection in route.connections
        ],
        "localPaths": [list(path) for path in route.local_paths],
    }
    route_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = route_path.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary_path.replace(route_path)


def _group_into_visits(photos: list[LibraryPhoto], areas: list[Area]) -> list[_Visit]:
    area_of_photo = {photo_id: area for area in areas for photo_id in area.photo_ids}
    visits: list[_Visit] = []
    for photo in photos:
        if not photo.metadata.has_location:
            continue
        area = area_of_photo.get(photo.id)
        if visits and visits[-1].area is area:
            visits[-1].photos.append(photo)
        else:
            visits.append(_Visit(area=area, photos=[photo]))
    return visits


def _connect(from_area: Area, to_area: Area) -> AreaConnection:
    from_point, to_point = _visible_part_between(from_area, to_area)
    return AreaConnection(
        from_area_id=from_area.id,
        to_area_id=to_area.id,
        from_point=from_point,
        to_point=to_point,
    )


def _visible_part_between(from_area: Area, to_area: Area) -> tuple[tuple[float, float], tuple[float, float]]:
    from_middle = (from_area.label_point[1], from_area.label_point[0])
    to_middle = (to_area.label_point[1], to_area.label_point[0])
    middle_to_middle = LineString([from_middle, to_middle])
    leaves_from_area_at = _furthest_position_inside(middle_to_middle, from_area.boundary)
    enters_to_area_at = middle_to_middle.length - _furthest_position_inside(
        middle_to_middle.reverse(), to_area.boundary
    )
    if leaves_from_area_at >= enters_to_area_at:
        leaves_from_area_at = enters_to_area_at = middle_to_middle.length / 2
    start = middle_to_middle.interpolate(leaves_from_area_at)
    end = middle_to_middle.interpolate(enters_to_area_at)
    return (start.y, start.x), (end.y, end.x)


def _furthest_position_inside(line: LineString, area_boundary: BaseGeometry) -> float:
    inside_parts = line.intersection(area_boundary)
    if inside_parts.is_empty:
        return 0.0
    return max(line.project(shapely.Point(coordinate)) for coordinate in shapely.get_coordinates(inside_parts))


def _display_boundary(boundary: BaseGeometry) -> dict:
    simplified = boundary.simplify(BOUNDARY_DISPLAY_SIMPLIFICATION_DEGREES, preserve_topology=True)
    return _rounded_geometry(mapping(simplified))


def _rounded_geometry(geometry: dict) -> dict:
    def round_coordinates(value):
        if isinstance(value, (list, tuple)) and value and isinstance(value[0], (int, float)):
            return [round(component, BOUNDARY_COORDINATE_DECIMALS) for component in value]
        return [round_coordinates(item) for item in value]

    return {"type": geometry["type"], "coordinates": round_coordinates(geometry["coordinates"])}
