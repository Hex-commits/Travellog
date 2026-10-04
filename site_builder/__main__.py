import argparse
import logging
import sys
from dataclasses import replace
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from site_builder.albums import (
    AlbumSummary,
    group_by_album,
    remove_other_albums,
    summarize_album,
    write_album_index,
)
from site_builder.area_map import write_area_map
from site_builder.areas import group_into_areas
from site_builder.district_lookup import DistrictLookup, DistrictLookupError
from site_builder.library import LibraryPhoto, scan
from site_builder.publisher import publish
from site_builder.settings import Settings

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    """Publish every album folder in the raw folder to the GitHub Pages site, each with the areas its photos were taken in.

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
        logging.error("No photos found in %s. Put each album in its own folder there and run this again.", settings.raw_dir)
        return 1
    photos = _taken_since(library_photos, arguments.since)
    if not photos:
        logging.error("None of the %d photos were taken on or after %s.", len(library_photos), arguments.since)
        return 1
    albums = group_by_album(photos)
    district_lookup = DistrictLookup(settings.district_cache_path)
    summaries: list[AlbumSummary] = []
    for album_name, album_photos in albums.items():
        summary = _unique_slug(summarize_album(album_name, album_photos), {known.slug for known in summaries})
        logging.info("Album %s (%s): %d photos", album_name, summary.slug, len(album_photos))
        album_settings = settings.for_album(summary.slug)
        _publish_album(album_photos, album_settings)
        _update_areas(album_photos, album_settings, district_lookup)
        summaries.append(summary)
    write_album_index(summaries, settings.album_index_path)
    for removed_slug in remove_other_albums(settings.albums_dir, (summary.slug for summary in summaries)):
        logging.info("Removed album %s, its folder is no longer in %s", removed_slug, settings.raw_dir)
    return 0


def _unique_slug(summary: AlbumSummary, taken_slugs: set[str]) -> AlbumSummary:
    slug = summary.slug
    counter = 2
    while slug in taken_slugs:
        slug = f"{summary.slug}-{counter}"
        counter += 1
    return replace(summary, slug=slug)


def _publish_album(photos: list[LibraryPhoto], settings: Settings) -> None:
    result = publish(photos, settings)
    located_count = sum(1 for photo in photos if photo.metadata.has_location)
    logging.info(
        "  Shows %d photos (%d added, %d removed). %d of them have a location.",
        result.published_count,
        result.added_count,
        result.removed_count,
        located_count,
    )
    for failed_file in result.failed_files:
        logging.warning("  Not published, could not be read: %s", failed_file)


def _update_areas(photos: list[LibraryPhoto], settings: Settings, district_lookup: DistrictLookup) -> None:
    try:
        areas = group_into_areas(photos, district_lookup.district_at)
    except DistrictLookupError as error:
        logging.warning("  Kept the previous areas because the area lookup failed: %s", error)
        return
    write_area_map(areas, settings.areas_path)
    for area in areas:
        logging.info("  %s (%s): %d photos", area.name, area.name_ja or "-", len(area.photo_ids))


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
