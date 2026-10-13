import logging
import shutil
import uuid
import zipfile
from pathlib import Path, PurePosixPath

from site_builder.library import IGNORED_FOLDER_NAMES, IMAGE_EXTENSIONS

ARCHIVE_EXTENSION = ".zip"
EXTRACTED_EXTENSIONS = IMAGE_EXTENSIONS | {".json"}

logger = logging.getLogger(__name__)


def extract_new_archives(raw_dir: Path) -> None:
    """Unpack the photos and their Takeout JSON files from every zip archive in the raw folder that are not unpacked yet.

    Args:
        raw_dir: Folder holding the album folders and the downloaded archives.
    """
    for archive_path in sorted(raw_dir.glob("*")):
        if not _is_archive(archive_path):
            continue
        try:
            extracted_count = _extract_missing_members(archive_path, raw_dir)
        except (OSError, zipfile.BadZipFile) as error:
            logger.warning("Skipped archive %s: %s", archive_path.name, error)
            continue
        if extracted_count:
            logger.info("Unpacked %d %s from %s", extracted_count, "file" if extracted_count == 1 else "files", archive_path.name)


def _is_archive(path: Path) -> bool:
    return path.is_file() and not path.name.startswith(".") and path.suffix.lower() == ARCHIVE_EXTENSION


def _extract_missing_members(archive_path: Path, raw_dir: Path) -> int:
    extracted_count = 0
    with zipfile.ZipFile(archive_path) as archive:
        for member in archive.infolist():
            target = _target_path(member, archive_path, raw_dir)
            if target is None or _is_already_extracted(target, member):
                continue
            _extract_member(archive, member, target)
            extracted_count += 1
    return extracted_count


def _target_path(member: zipfile.ZipInfo, archive_path: Path, raw_dir: Path) -> Path | None:
    member_path = PurePosixPath(member.filename)
    if member.is_dir() or member_path.is_absolute() or not _is_wanted(member_path):
        return None
    if len(member_path.parts) == 1:
        return raw_dir / archive_path.stem / member_path.name
    return raw_dir.joinpath(*member_path.parts)


def _is_wanted(member_path: PurePosixPath) -> bool:
    is_hidden = any(part.startswith(".") or part in IGNORED_FOLDER_NAMES for part in member_path.parts)
    return not is_hidden and member_path.suffix.lower() in EXTRACTED_EXTENSIONS


def _is_already_extracted(target: Path, member: zipfile.ZipInfo) -> bool:
    return target.is_file() and target.stat().st_size == member.file_size


def _extract_member(archive: zipfile.ZipFile, member: zipfile.ZipInfo, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
    with archive.open(member) as source, temporary_path.open("wb") as destination:
        shutil.copyfileobj(source, destination)
    temporary_path.replace(target)
