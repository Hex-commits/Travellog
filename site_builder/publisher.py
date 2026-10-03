import json
import logging
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from site_builder.imaging import render_jpeg
from site_builder.library import LibraryPhoto
from site_builder.settings import Settings

COORDINATE_DECIMALS = 5

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PublishedPhoto:
    id: str
    taken_at: str | None
    latitude: float | None
    longitude: float | None
    width: int
    height: int
    full_image: str
    thumbnail: str


@dataclass(frozen=True)
class PublishResult:
    published_count: int
    added_count: int
    removed_count: int
    failed_files: list[str] = field(default_factory=list)


def publish(photos: Iterable[LibraryPhoto], settings: Settings) -> PublishResult:
    """Make the site show exactly the given photos, converting only the ones it does not have yet.

    Args:
        photos: Photos to show on the site.
        settings: Site folder location and image sizes.

    Returns:
        How many photos are published, added and removed, and which files failed.
    """
    previously_published = _load_published_photos(settings)
    published: dict[str, PublishedPhoto] = {}
    failed_files = []
    for photo in photos:
        try:
            published[photo.id] = _publish_library_photo(photo, previously_published.get(photo.id), settings)
        except (OSError, SyntaxError, ValueError) as error:
            logger.warning("Could not convert %s: %s", photo.relative_path, error)
            failed_files.append(photo.relative_path)
            continue
        if photo.id not in previously_published:
            logger.info("Converted %s", photo.source_path.name)
    ordered_photos = sorted(published.values(), key=_chronological_order)
    _write_manifest(ordered_photos, settings)
    _remove_unpublished_images(published.keys(), settings)
    return PublishResult(
        published_count=len(ordered_photos),
        added_count=len(published.keys() - previously_published.keys()),
        removed_count=len(previously_published.keys() - published.keys()),
        failed_files=failed_files,
    )


def _load_published_photos(settings: Settings) -> dict[str, PublishedPhoto]:
    try:
        manifest = json.loads(settings.manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    entries = manifest.get("photos", []) if isinstance(manifest, dict) else []
    published = (_from_manifest_entry(entry) for entry in entries if isinstance(entry, dict))
    return {photo.id: photo for photo in published if photo is not None}


def _publish_library_photo(
    photo: LibraryPhoto,
    previous_version: PublishedPhoto | None,
    settings: Settings,
) -> PublishedPhoto:
    full_image_path = settings.full_images_dir / f"{photo.id}.jpg"
    thumbnail_path = settings.site_thumbnails_dir / f"{photo.id}.jpg"
    if previous_version and full_image_path.exists() and thumbnail_path.exists():
        width, height = previous_version.width, previous_version.height
    else:
        width, height = render_jpeg(
            photo.source_path, full_image_path, settings.full_image_max_edge, settings.jpeg_quality
        )
        render_jpeg(full_image_path, thumbnail_path, settings.site_thumbnail_max_edge, settings.jpeg_quality)
    metadata = photo.metadata
    return PublishedPhoto(
        id=photo.id,
        taken_at=metadata.taken_at.isoformat(timespec="seconds") if metadata.taken_at else None,
        latitude=_rounded_coordinate(metadata.latitude),
        longitude=_rounded_coordinate(metadata.longitude),
        width=width,
        height=height,
        full_image=full_image_path.relative_to(settings.site_dir).as_posix(),
        thumbnail=thumbnail_path.relative_to(settings.site_dir).as_posix(),
    )


def _remove_unpublished_images(published_ids: Iterable[str], settings: Settings) -> None:
    kept_ids = set(published_ids)
    for image_folder in (settings.full_images_dir, settings.site_thumbnails_dir):
        for image_path in image_folder.glob("*.jpg"):
            if image_path.stem not in kept_ids:
                image_path.unlink()


def _write_manifest(photos: list[PublishedPhoto], settings: Settings) -> None:
    manifest = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "photos": [_to_manifest_entry(photo) for photo in photos],
    }
    settings.manifest_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = settings.manifest_path.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary_path.replace(settings.manifest_path)


def _to_manifest_entry(photo: PublishedPhoto) -> dict:
    return {
        "id": photo.id,
        "takenAt": photo.taken_at,
        "latitude": photo.latitude,
        "longitude": photo.longitude,
        "width": photo.width,
        "height": photo.height,
        "full": photo.full_image,
        "thumb": photo.thumbnail,
    }


def _from_manifest_entry(entry: dict) -> PublishedPhoto | None:
    try:
        return PublishedPhoto(
            id=str(entry["id"]),
            taken_at=entry.get("takenAt"),
            latitude=entry.get("latitude"),
            longitude=entry.get("longitude"),
            width=int(entry["width"]),
            height=int(entry["height"]),
            full_image=str(entry["full"]),
            thumbnail=str(entry["thumb"]),
        )
    except (KeyError, TypeError, ValueError):
        return None


def _rounded_coordinate(value: float | None) -> float | None:
    return round(value, COORDINATE_DECIMALS) if value is not None else None


def _chronological_order(photo: PublishedPhoto) -> tuple[bool, str, str]:
    return photo.taken_at is None, photo.taken_at or "", photo.id
