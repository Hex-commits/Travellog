import hashlib
import json
import re
import shutil
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from site_builder.library import LibraryPhoto

SLUG_SEPARATOR_PATTERN = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class AlbumSummary:
    slug: str
    name: str
    photo_count: int
    first_day: str | None
    last_day: str | None


def group_by_album(photos: Iterable[LibraryPhoto]) -> dict[str, list[LibraryPhoto]]:
    """Split photos into their albums, keeping their order.

    Args:
        photos: Photos in chronological order.

    Returns:
        Photos keyed by album name.
    """
    photos_by_album: dict[str, list[LibraryPhoto]] = {}
    for photo in photos:
        photos_by_album.setdefault(photo.album, []).append(photo)
    return photos_by_album


def album_slug(album_name: str) -> str:
    """Turn an album folder name into a web-safe name for its address.

    Args:
        album_name: Name of the album folder.

    Returns:
        Lower-case name made of letters, digits and hyphens.
    """
    plain_name = unicodedata.normalize("NFKD", album_name).encode("ascii", "ignore").decode("ascii")
    slug = SLUG_SEPARATOR_PATTERN.sub("-", plain_name.lower()).strip("-")
    return slug or f"album-{hashlib.sha1(album_name.encode('utf-8')).hexdigest()[:8]}"


def summarize_album(album_name: str, photos: list[LibraryPhoto]) -> AlbumSummary:
    """Describe an album for the album menu.

    Args:
        album_name: Name of the album folder.
        photos: The album's photos in chronological order.

    Returns:
        The album's address name, title, photo count and first and last day.
    """
    days = sorted(photo.metadata.taken_at.date().isoformat() for photo in photos if photo.metadata.taken_at)
    return AlbumSummary(
        slug=album_slug(album_name),
        name=album_name,
        photo_count=len(photos),
        first_day=days[0] if days else None,
        last_day=days[-1] if days else None,
    )


def write_album_index(albums: Iterable[AlbumSummary], index_path: Path) -> None:
    """Save the list of albums, most recent first.

    Args:
        albums: Albums on the site.
        index_path: Path of the JSON file the site reads.
    """
    newest_first = sorted(albums, key=lambda album: (album.last_day or "", album.name), reverse=True)
    payload = {
        "albums": [
            {
                "slug": album.slug,
                "name": album.name,
                "photoCount": album.photo_count,
                "firstDay": album.first_day,
                "lastDay": album.last_day,
            }
            for album in newest_first
        ]
    }
    index_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = index_path.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary_path.replace(index_path)


def remove_other_albums(albums_dir: Path, kept_slugs: Iterable[str]) -> list[str]:
    """Delete the site folders of albums that no longer exist in the raw folder.

    Args:
        albums_dir: Folder holding one folder per published album.
        kept_slugs: Address names of the albums to keep.

    Returns:
        Address names of the removed albums.
    """
    kept = set(kept_slugs)
    removed = []
    if not albums_dir.is_dir():
        return removed
    for album_dir in sorted(albums_dir.iterdir()):
        if album_dir.is_dir() and album_dir.name not in kept:
            shutil.rmtree(album_dir)
            removed.append(album_dir.name)
    return removed
