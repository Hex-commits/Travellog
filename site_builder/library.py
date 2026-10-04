import hashlib
import json
import logging
import os
from collections import Counter, defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from site_builder.metadata import PhotoMetadata, read_metadata
from site_builder.settings import Settings
from site_builder.takeout import find_sidecar_name

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"})
IGNORED_FOLDER_NAMES = frozenset({"__MACOSX"})
CACHE_FORMAT_VERSION = 1

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LibraryPhoto:
    id: str
    album: str
    source_path: Path
    relative_path: str
    metadata: PhotoMetadata


@dataclass(frozen=True)
class _SourceFile:
    path: Path
    relative_path: str
    size: int
    modified_ns: int
    sidecar_path: Path | None
    sidecar_relative_path: str | None


def scan(settings: Settings) -> list[LibraryPhoto]:
    """Find every photo in the album folders of the raw folder, with when and where it was taken.

    Args:
        settings: Folder locations and timezone.

    Returns:
        Photos without duplicates inside an album, oldest first.
    """
    settings.raw_dir.mkdir(parents=True, exist_ok=True)
    sources = list(_find_source_files(settings.raw_dir))
    _log_folder_counts(sources)
    cached_entries = _load_cache(settings.library_cache_path)
    current_entries = {}
    photos_by_album_and_id: dict[tuple[str, str], LibraryPhoto] = {}
    loose_files = []
    for source in sources:
        album = _album_of(source)
        if album is None:
            loose_files.append(source.relative_path)
            continue
        photo_id = _photo_id(source)
        if (album, photo_id) in photos_by_album_and_id:
            continue
        metadata = _metadata_from_cache(cached_entries.get(source.relative_path), source)
        if metadata is None:
            try:
                metadata = read_metadata(source.path, source.sidecar_path, settings.fallback_timezone)
            except (OSError, SyntaxError, ValueError) as error:
                logger.warning("Skipped %s: %s", source.relative_path, error)
                continue
        current_entries[source.relative_path] = _cache_entry(source, metadata)
        photos_by_album_and_id[(album, photo_id)] = LibraryPhoto(
            id=photo_id,
            album=album,
            source_path=source.path,
            relative_path=source.relative_path,
            metadata=metadata,
        )
    _save_cache(settings.library_cache_path, current_entries)
    if loose_files:
        logger.warning(
            "Skipped %d %s lying directly in the raw folder; put them in an album folder.",
            len(loose_files),
            "photo" if len(loose_files) == 1 else "photos",
        )
    return sorted(photos_by_album_and_id.values(), key=_chronological_order)


def _find_source_files(raw_dir: Path) -> Iterator[_SourceFile]:
    image_paths: list[Path] = []
    sidecars_by_album: dict[str, dict[str, Path]] = defaultdict(dict)
    for folder, subfolder_names, file_names in os.walk(raw_dir):
        subfolder_names[:] = sorted(name for name in subfolder_names if _is_scannable_folder(name))
        folder_path = Path(folder)
        for file_name in sorted(file_names):
            if file_name.startswith("."):
                continue
            extension = os.path.splitext(file_name)[1].lower()
            if extension in IMAGE_EXTENSIONS:
                image_paths.append(folder_path / file_name)
            elif extension == ".json":
                sidecars_by_album[folder_path.name][file_name] = folder_path / file_name
    for image_path in image_paths:
        album_sidecars = sidecars_by_album.get(image_path.parent.name, {})
        sidecar_name = find_sidecar_name(image_path.name, album_sidecars.keys())
        sidecar_path = album_sidecars.get(sidecar_name) if sidecar_name else None
        file_status = image_path.stat()
        yield _SourceFile(
            path=image_path,
            relative_path=image_path.relative_to(raw_dir).as_posix(),
            size=file_status.st_size,
            modified_ns=file_status.st_mtime_ns,
            sidecar_path=sidecar_path,
            sidecar_relative_path=sidecar_path.relative_to(raw_dir).as_posix() if sidecar_path else None,
        )


def _is_scannable_folder(folder_name: str) -> bool:
    return not (folder_name.startswith(".") or folder_name in IGNORED_FOLDER_NAMES)


def _log_folder_counts(sources: list[_SourceFile]) -> None:
    photos_per_folder = Counter(Path(source.relative_path).parent.as_posix() for source in sources)
    for folder, photo_count in sorted(photos_per_folder.items()):
        folder_label = "raw" if folder == "." else f"raw/{folder}"
        logger.info("  %s: %d %s", folder_label, photo_count, "photo" if photo_count == 1 else "photos")


def _album_of(source: _SourceFile) -> str | None:
    folder_names = Path(source.relative_path).parts[:-1]
    return folder_names[0] if folder_names else None


def _photo_id(source: _SourceFile) -> str:
    fingerprint = f"{source.path.name}:{source.size}"
    return hashlib.sha1(fingerprint.encode("utf-8")).hexdigest()[:12]


def _chronological_order(photo: LibraryPhoto) -> tuple[bool, datetime, str]:
    taken_at = photo.metadata.taken_at
    return taken_at is None, taken_at or datetime.min, photo.relative_path


def _metadata_from_cache(entry: dict | None, source: _SourceFile) -> PhotoMetadata | None:
    if not entry:
        return None
    is_unchanged = (
        entry.get("size") == source.size
        and entry.get("modifiedNs") == source.modified_ns
        and entry.get("sidecar") == source.sidecar_relative_path
    )
    if not is_unchanged:
        return None
    taken_at = entry.get("takenAt")
    return PhotoMetadata(
        taken_at=datetime.fromisoformat(taken_at) if taken_at else None,
        latitude=entry.get("latitude"),
        longitude=entry.get("longitude"),
    )


def _cache_entry(source: _SourceFile, metadata: PhotoMetadata) -> dict:
    return {
        "size": source.size,
        "modifiedNs": source.modified_ns,
        "sidecar": source.sidecar_relative_path,
        "takenAt": metadata.taken_at.isoformat() if metadata.taken_at else None,
        "latitude": metadata.latitude,
        "longitude": metadata.longitude,
    }


def _load_cache(cache_path: Path) -> dict[str, dict]:
    try:
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(cache, dict) or cache.get("version") != CACHE_FORMAT_VERSION:
        return {}
    return cache.get("entries", {})


def _save_cache(cache_path: Path, entries: dict[str, dict]) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = cache_path.with_suffix(".tmp")
    temporary_path.write_text(json.dumps({"version": CACHE_FORMAT_VERSION, "entries": entries}), encoding="utf-8")
    temporary_path.replace(cache_path)
