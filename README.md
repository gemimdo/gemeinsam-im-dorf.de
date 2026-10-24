# gemeinsam-im-dorf.de

Static Astro site whose content is managed in Google:

| Page | Source | Notes |
|---|---|---|
| `/kalender/` | Google Calendar | Events from 1 month ago to 12 months ahead. Past events are hidden in the browser even between builds. |
| `/galerie/` | Google Drive folder "photos" | Subfolders become tags. Images are downloaded and converted to WebP at build time. |
| `/dokumente/` | Google Drive folder "documents" | Subfolders become tags. Links open the file in Google Drive. |

Everything is fetched **at build time**. Visitors never load anything from Google
(no cookie/consent banner needed for this), but new content only appears after the
next build – so the host must rebuild on a schedule.

## Google setup (one-time)

1. **API key** – in [Google Cloud Console](https://console.cloud.google.com/):
   create a project, enable *Google Drive API* and *Google Calendar API*,
   then *Credentials → Create credentials → API key*. Restrict the key to those two APIs.
   The key is only used during the build and never ends up in the site output.
2. **Calendar** – Calendar settings → *Access permissions* → "Make available to public"
   with "See all event details". Copy the *Calendar ID* from "Integrate calendar".
3. **Drive folders** – share both folders as "Anyone with the link – Viewer".
   The folder ID is the last part of the folder URL.
4. Copy `.env.example` to `.env` and fill in the four values (on the host: set them as
   environment variables / build secrets).

### Drive folder layout

```
Fotos/                    → DRIVE_PHOTOS_FOLDER_ID
├── Dorfplatz.jpg         (no tag)
├── 2025/
│   └── Maifest/
│       └── Maibaum.jpg   tags: 2025, Maifest
Dokumente/                → DRIVE_DOCUMENTS_FOLDER_ID
├── Protokolle/…          tag: Protokolle
└── Formulare/…           tag: Formulare
```

- Photo captions come from the Drive file *description* (fallback: file name).
- Photos are sorted by the date they were taken (EXIF), falling back to the upload date.
- Supported photo formats: JPEG, PNG, WebP, GIF, AVIF, TIFF. **iPhone HEIC files are skipped**
  (the build log lists them) – export them as JPEG or set the iPhone camera to "Most Compatible".

## Development

```sh
bun install
bun run dev      # without .env the site builds with empty collections
bun run build
bun run check    # type check
```
