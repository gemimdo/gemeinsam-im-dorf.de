# gemeinsam-im-dorf.de

Static Astro site for the village club. The design comes from the "Dorfverein Website"
design canvas. Content is maintained in Google Calendar and Google Drive and pulled in **at
build time**. Visitors never load anything from Google: photos, fonts and documents are
copied onto the site, so no cookie or consent banner is needed for them.

New content appears only after the next build (`bun run build`, then upload `dist/`).

## Where content comes from

| What | Source |
|---|---|
| Termine (`/termine/`, start page calendar) | Google Calendar |
| Galerie, start page photos | Drive folder `DRIVE_PHOTOS_FOLDER_ID` |
| Dokumente, current flyer | Drive folder `DRIVE_DOCUMENTS_FOLDER_ID` |
| Club texts, board, address, village facts | [`src/site.config.ts`](src/site.config.ts) – everything in `[brackets]` is still a placeholder |

### Google Calendar

- **Category** (coloured dot): the event colour. Blue tones (Heidelbeere, Pfau, Lavendel) →
  *Feste & Kultur*, green tones (Basilikum, Salbei) → *Kinder & Familie*, everything else →
  *Vereinsleben*. Change the mapping in `src/site.config.ts`.
- **Description**: shown as event details. The lines `Eintritt: …` and `Kontakt: …` are
  picked out and shown as their own rows.
- The calendar must be public ("Make available to public" + "See all event details").

### Drive folders

```
Fotos/                         → DRIVE_PHOTOS_FOLDER_ID
├── Startseite/                header photos on the start page (not in the gallery)
├── Sommerfest 2026/           album "Sommerfest 2026"
└── Dorfteich/                 album "Dorfteich"

Dokumente/                     → DRIVE_DOCUMENTS_FOLDER_ID
├── Aushänge/                  flyers – the newest one is featured on the start page
├── Formulare/                 category "Formulare"
├── Protokolle/
└── Verein/
```

- Photo captions come from the Drive file **description** (fallback: file name). Photos are
  sorted by the date they were taken.
- Flyer: title = file name, the description is shown below it (e.g. "Samstag, 5. Dezember ·
  ab 15 Uhr · Dorfanger"). PDFs get a preview image from Drive's rendering of page 1.
- Google Docs/Sheets/Slides are offered as PDF. Google Forms are skipped.
- Supported photo formats: JPEG, PNG, WebP, GIF, AVIF, TIFF. **iPhone HEIC files are skipped**
  (the build log lists them).
- Both folders must be shared as "Anyone with the link – Viewer".

## Google setup (one-time)

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project, enable
   *Google Drive API* and *Google Calendar API*, create an API key and restrict it to those
   two APIs. It is only used during the build and never ends up in the site.
2. Copy `.env.example` to `.env` and fill in the key, the calendar ID and both folder IDs.

## Development

```sh
bun install
bun run dev      # local server on http://localhost:4321 – Google data is loaded at startup
bun run build    # static site in dist/
bun run preview  # serve dist/ locally
bun run check    # type check
```

Without `.env` the site still builds, just with empty calendar, gallery and documents.

## Not covered by a static site

- **Contact form** (`/verein/#mitglied`) opens the visitor's mail program with the message
  pre-filled. A real form needs a small server script (Strato supports PHP).
- **Members-only documents**: there is no login. The design's member area is replaced by a
  "ask the board" box.
- **Impressum / Datenschutz** are placeholders and must be written by the club.
