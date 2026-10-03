import os
import re
from collections.abc import Collection, Iterator

SUPPLEMENTAL_METADATA_SUFFIX = ".supplemental-metadata"
SHORTEST_TRUNCATED_SIDECAR_STEM = 40
EDITED_COPY_SUFFIXES = ("-edited", "-bearbeitet")
DUPLICATE_COUNTER_PATTERN = re.compile(r"^(?P<name>.*)(?P<counter>\(\d+\))$")


def find_sidecar_name(image_name: str, json_names: Collection[str]) -> str | None:
    """Find the Takeout JSON file that describes an image.

    Args:
        image_name: File name of the image.
        json_names: JSON file names from the image's album folder.

    Returns:
        The matching JSON file name, or None when there is none.
    """
    for media_name in _original_media_names(image_name):
        for candidate in _sidecar_candidates(media_name):
            if candidate in json_names:
                return candidate
    return None


def _original_media_names(image_name: str) -> Iterator[str]:
    yield image_name
    stem, extension = os.path.splitext(image_name)
    for suffix in EDITED_COPY_SUFFIXES:
        if stem.endswith(suffix):
            yield stem.removesuffix(suffix) + extension


def _sidecar_candidates(media_name: str) -> Iterator[str]:
    stem, extension = os.path.splitext(media_name)
    duplicate_match = DUPLICATE_COUNTER_PATTERN.match(stem)
    if duplicate_match is not None:
        yield from _sidecar_candidates_for(duplicate_match["name"], extension, duplicate_match["counter"])
    yield from _sidecar_candidates_for(stem, extension, "")


def _sidecar_candidates_for(stem: str, extension: str, counter: str) -> Iterator[str]:
    media_name = stem + extension
    longest_sidecar_stem = media_name + SUPPLEMENTAL_METADATA_SUFFIX
    shortest_length = min(len(media_name), SHORTEST_TRUNCATED_SIDECAR_STEM)
    for length in range(len(longest_sidecar_stem), shortest_length - 1, -1):
        yield f"{longest_sidecar_stem[:length]}{counter}.json"
    yield f"{stem}{counter}.json"
