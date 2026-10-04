import json
from collections.abc import Iterable
from pathlib import Path

from shapely.geometry import mapping
from shapely.geometry.base import BaseGeometry

from site_builder.areas import Area

COORDINATE_DECIMALS = 5
BOUNDARY_COORDINATE_DECIMALS = 4
BOUNDARY_DISPLAY_SIMPLIFICATION_DEGREES = 0.0008


def write_area_map(areas: Iterable[Area], areas_path: Path) -> None:
    """Save the areas with their simplified outlines, label points and photos for the site.

    Args:
        areas: Areas in the order they were first visited.
        areas_path: Path of the JSON file the site reads.
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
            for area in areas
        ]
    }
    areas_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = areas_path.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary_path.replace(areas_path)


def _display_boundary(boundary: BaseGeometry) -> dict:
    simplified = boundary.simplify(BOUNDARY_DISPLAY_SIMPLIFICATION_DEGREES, preserve_topology=True)
    return _rounded_geometry(mapping(simplified))


def _rounded_geometry(geometry: dict) -> dict:
    def round_coordinates(value):
        if isinstance(value, (list, tuple)) and value and isinstance(value[0], (int, float)):
            return [round(component, BOUNDARY_COORDINATE_DECIMALS) for component in value]
        return [round_coordinates(item) for item in value]

    return {"type": geometry["type"], "coordinates": round_coordinates(geometry["coordinates"])}
