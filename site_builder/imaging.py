import uuid
from pathlib import Path

from PIL import ExifTags, Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()


def read_exif(source: Path) -> Image.Exif:
    """Read the EXIF block of an image without decoding its pixels.

    Args:
        source: Image file to read.

    Returns:
        The image's EXIF data, empty when it has none.
    """
    with Image.open(source) as image:
        exif = image.getexif()
        for nested_block in (ExifTags.IFD.Exif, ExifTags.IFD.GPSInfo):
            exif.get_ifd(nested_block)
        return exif


def render_jpeg(source: Path, target: Path, max_edge: int, quality: int) -> tuple[int, int]:
    """Save an upright, downscaled JPEG copy of an image without its EXIF data.

    Args:
        source: Image file to convert.
        target: Path of the JPEG to write.
        max_edge: Longest allowed side in pixels.
        quality: JPEG quality from 1 to 95.

    Returns:
        Width and height of the saved JPEG.
    """
    with Image.open(source) as image:
        image.draft("RGB", (max_edge, max_edge))
        color_profile = image.info.get("icc_profile")
        upright = ImageOps.exif_transpose(image)
        upright.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS, reducing_gap=3.0)
        output = upright.convert("RGB")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
    output.save(
        temporary_path,
        "JPEG",
        quality=quality,
        optimize=True,
        progressive=True,
        icc_profile=color_profile,
    )
    temporary_path.replace(target)
    return output.size
