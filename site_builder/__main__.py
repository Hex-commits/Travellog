import argparse
import logging
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from site_builder.areas import group_into_areas
from site_builder.district_lookup import DistrictLookup, DistrictLookupError
from site_builder.library import LibraryPhoto, scan
from site_builder.publisher import publish
from site_builder.settings import Settings
from site_builder.travel_route import build_travel_route, write_route

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    """Publish every photo from the raw folder to the GitHub Pages site and connect the cities they were taken in.

    Returns:
        Exit code for the shell.
    """
    arguments = _parse_arguments()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    settings = Settings(
        raw_dir=arguments.raw_dir.resolve(),
        site_dir=arguments.site_dir.resolve(),
        cache_dir=arguments.cache_dir.resolve(),
        fallback_timezone=ZoneInfo(arguments.timezone),
    )
    logging.info("Scanning %s", settings.raw_dir)
    library_photos = scan(settings)
    if not library_photos:
        logging.error("No photos found in %s. Unzip your photo downloads into it and run this again.", settings.raw_dir)
        return 1
    photos = _taken_since(library_photos, arguments.since)
    if not photos:
        logging.error("None of the %d photos were taken on or after %s.", len(library_photos), arguments.since)
        return 1
    result = publish(photos, settings)
    located_count = sum(1 for photo in photos if photo.metadata.has_location)
    logging.info(
        "Site now shows %d photos (%d added, %d removed). %d of them have a location.",
        result.published_count,
        result.added_count,
        result.removed_count,
        located_count,
    )
    for failed_file in result.failed_files:
        logging.warning("Not published, could not be read: %s", failed_file)
    _update_travel_route(photos, settings)
    return 0


def _update_travel_route(photos: list[LibraryPhoto], settings: Settings) -> None:
    logging.info("Finding the areas the photos were taken in")
    try:
        areas = group_into_areas(photos, DistrictLookup(settings.district_cache_path).district_at)
    except DistrictLookupError as error:
        logging.warning("Kept the previous travel route because the area lookup failed: %s", error)
        return
    route = build_travel_route(photos, areas)
    write_route(route, settings.route_path)
    for area in areas:
        logging.info("  %s (%s): %d photos", area.name, area.name_ja or "-", len(area.photo_ids))
    logging.info("Connected %d areas with %d connections", len(areas), len(route.connections))


def _taken_since(photos: list[LibraryPhoto], since: date | None) -> list[LibraryPhoto]:
    if since is None:
        return photos
    earliest = datetime.combine(since, datetime.min.time())
    return [photo for photo in photos if photo.metadata.taken_at and photo.metadata.taken_at >= earliest]


def _parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m site_builder",
        description="Publish the photos from the raw folder to the travel site.",
    )
    parser.add_argument("--since", type=date.fromisoformat, help="only photos taken on or after this day (YYYY-MM-DD)")
    parser.add_argument("--raw-dir", type=Path, default=PROJECT_ROOT / "raw", help="folder whose subfolders hold the photos")
    parser.add_argument("--site-dir", type=Path, default=PROJECT_ROOT / "docs", help="GitHub Pages folder")
    parser.add_argument("--cache-dir", type=Path, default=PROJECT_ROOT / ".cache", help="folder for the scan cache")
    parser.add_argument("--timezone", default="Asia/Tokyo", help="timezone for photos without a camera time")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
