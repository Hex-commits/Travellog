import json
import logging
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import ExifTags

from site_builder.imaging import read_exif

EXIF_TIMESTAMP_FORMAT = "%Y:%m:%d %H:%M:%S"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PhotoMetadata:
    taken_at: datetime | None = None
    latitude: float | None = None
    longitude: float | None = None

    @property
    def has_location(self) -> bool:
        return self.latitude is not None and self.longitude is not None


def read_metadata(image_path: Path, sidecar_path: Path | None, fallback_timezone: ZoneInfo) -> PhotoMetadata:
    """Determine when and where a photo was taken.

    Args:
        image_path: Image file to inspect.
        sidecar_path: Takeout JSON file describing the image, if any.
        fallback_timezone: Timezone for capture times that are only known in UTC.

    Returns:
        Capture time as local wall-clock time, and capture location.

    Raises:
        OSError: The image cannot be opened.
    """
    sidecar = _read_sidecar(sidecar_path, fallback_timezone) if sidecar_path else PhotoMetadata()
    embedded = _read_embedded(image_path)
    location_source = sidecar if sidecar.has_location else embedded
    return PhotoMetadata(
        taken_at=embedded.taken_at or sidecar.taken_at,
        latitude=location_source.latitude,
        longitude=location_source.longitude,
    )


def _read_sidecar(sidecar_path: Path, fallback_timezone: ZoneInfo) -> PhotoMetadata:
    try:
        details = json.loads(sidecar_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        logger.warning("Ignored unreadable %s: %s", sidecar_path.name, error)
        return PhotoMetadata()
    if not isinstance(details, dict):
        return PhotoMetadata()
    location = _first_valid_location(details.get("geoData"), details.get("geoDataExif"))
    return PhotoMetadata(
        taken_at=_parse_sidecar_timestamp(details.get("photoTakenTime"), fallback_timezone),
        latitude=location[0] if location else None,
        longitude=location[1] if location else None,
    )


def _read_embedded(image_path: Path) -> PhotoMetadata:
    exif = read_exif(image_path)
    capture_details = exif.get_ifd(ExifTags.IFD.Exif)
    taken_at = _parse_exif_timestamp(
        capture_details.get(ExifTags.Base.DateTimeOriginal) or capture_details.get(ExifTags.Base.DateTimeDigitized)
    )
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    location = _valid_location(
        _gps_coordinate(gps.get(ExifTags.GPS.GPSLatitude), gps.get(ExifTags.GPS.GPSLatitudeRef), "S"),
        _gps_coordinate(gps.get(ExifTags.GPS.GPSLongitude), gps.get(ExifTags.GPS.GPSLongitudeRef), "W"),
    )
    return PhotoMetadata(
        taken_at=taken_at,
        latitude=location[0] if location else None,
        longitude=location[1] if location else None,
    )


def _parse_sidecar_timestamp(taken_time: object, fallback_timezone: ZoneInfo) -> datetime | None:
    if not isinstance(taken_time, dict):
        return None
    try:
        seconds = int(taken_time["timestamp"])
    except (KeyError, TypeError, ValueError):
        return None
    if seconds <= 0:
        return None
    return datetime.fromtimestamp(seconds, tz=timezone.utc).astimezone(fallback_timezone).replace(tzinfo=None)


def _parse_exif_timestamp(value: object) -> datetime | None:
    if isinstance(value, bytes):
        value = value.decode("ascii", errors="ignore")
    if not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value.strip("\x00 "), EXIF_TIMESTAMP_FORMAT)
    except ValueError:
        return None


def _gps_coordinate(parts: object, reference: object, negative_reference: str) -> float | None:
    if not isinstance(parts, tuple) or len(parts) != 3:
        return None
    try:
        degrees, minutes, seconds = (float(part) for part in parts)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    magnitude = degrees + minutes / 60 + seconds / 3600
    if isinstance(reference, bytes):
        reference = reference.decode("ascii", errors="ignore")
    is_negative = str(reference).strip("\x00 ").upper() == negative_reference
    return -magnitude if is_negative else magnitude


def _first_valid_location(*geo_blocks: object) -> tuple[float, float] | None:
    for block in geo_blocks:
        if isinstance(block, dict):
            location = _valid_location(block.get("latitude"), block.get("longitude"))
            if location:
                return location
    return None


def _valid_location(latitude: object, longitude: object) -> tuple[float, float] | None:
    if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
        return None
    if not (math.isfinite(latitude) and math.isfinite(longitude)):
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    if latitude == 0 and longitude == 0:
        return None
    return float(latitude), float(longitude)
