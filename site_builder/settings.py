from dataclasses import dataclass, replace
from pathlib import Path
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class Settings:
    raw_dir: Path
    site_dir: Path
    cache_dir: Path
    fallback_timezone: ZoneInfo
    full_image_max_edge: int = 2048
    site_thumbnail_max_edge: int = 480
    jpeg_quality: int = 84

    def for_album(self, album_slug: str) -> "Settings":
        """Get the settings for one album, whose site files live in their own folder.

        Args:
            album_slug: Web-safe name of the album.

        Returns:
            Settings whose site folder is the album's folder.
        """
        return replace(self, site_dir=self.albums_dir / album_slug)

    @property
    def albums_dir(self) -> Path:
        return self.site_dir / "albums"

    @property
    def album_index_path(self) -> Path:
        return self.site_dir / "data" / "albums.json"

    @property
    def library_cache_path(self) -> Path:
        return self.cache_dir / "library.json"

    @property
    def manifest_path(self) -> Path:
        return self.site_dir / "data" / "photos.json"

    @property
    def areas_path(self) -> Path:
        return self.site_dir / "data" / "areas.json"

    @property
    def district_cache_path(self) -> Path:
        return self.cache_dir / "districts.json"

    @property
    def full_images_dir(self) -> Path:
        return self.site_dir / "photos" / "full"

    @property
    def site_thumbnails_dir(self) -> Path:
        return self.site_dir / "photos" / "thumb"
