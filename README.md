# TravelJapan2026

## Export photos from Google Photos

[Open Google Takeout](https://takeout.google.com/)

1. Click **Deselect all**, then tick only **Google Photos**.
2. Click **All photo albums included** and select only **Photos from 2026**.
3. Choose **Send download link via email** as the delivery method.
4. Click **Create export**. Once the email arrives, download the zip files and unzip them into `raw/`.

## Build the site

Set up once:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Publish every photo from every folder in `raw/` to `docs/`:

```sh
.venv/bin/python -m site_builder
```

It then looks up the city, or the ward in big cities, where each photo was taken (from OpenStreetMap, so the first run needs internet). Areas that border each other are merged. Areas are connected in the order you visited them, with lines aimed at their middles but drawn only between their outlines.

Add `--since 2026-10-01` to skip photos taken before that day. Running it again only converts new photos and removes ones that are no longer in `raw/`.

Preview the site at <http://localhost:8000>:

```sh
python3 -m http.server -d docs 8000
```

## Publish on GitHub Pages

Push the repository to GitHub, then go to **Settings → Pages**, choose **Deploy from a branch**, and select `main` with the `/docs` folder.
