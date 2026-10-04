# TravelJapan2026

## Export photos from Google Photos

Download from e.g. Google Photos as a directory.

## Build the site

Set up once:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Each folder inside `raw/` becomes an album with its own page; click the album name at the top of the site to switch albums. Publish all albums to `docs/`:

```sh
.venv/bin/python -m site_builder
```

Preview the site at <http://localhost:8000>:

```sh
.venv/bin/python -m site_builder.preview
```

## Publish on GitHub Pages

Push the repository to GitHub, then go to **Settings → Pages**, choose **Deploy from a branch**, and select `master` with the `/docs` folder.
