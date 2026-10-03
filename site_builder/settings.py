from dataclasses import dataclass
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

    @property
    def library_cache_path(self) -> Path:
        return self.cache_dir / "library.json"

    @property
    def manifest_path(self) -> Path:
        return self.site_dir / "data" / "photos.json"

    @property
    def route_path(self) -> Path:
        return self.site_dir / "data" / "route.json"

    @property
    def district_cache_path(self) -> Path:
        return self.cache_dir / "districts.json"

    @property
    def full_images_dir(self) -> Path:
        return self.site_dir / "photos" / "full"

    @property
    def site_thumbnails_dir(self) -> Path:
        return self.site_dir / "photos" / "thumb"
