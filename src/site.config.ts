// Everything the club edits by hand lives here. Values in [brackets] are
// placeholders from the design and still need real content.

export const site = {
  clubName: "Gemeinsam Im Dorf",
  village: "Rockau",
  legalForm: "e.V.",
  founded: "2025",
  members: "über 10",
  annualFee: "24 €",
  reducedFee: "12 €",

  address: { street: "Rockau 51", zip: "07619", city: "Schkölen" },
  email: "gemimdo@yahoo.com",
  phone: "0176 64103757",

  board: [
    { name: "Danny Himmelreich", role: "1. Vorsitz" },
    { name: "Dorothea Roth", role: "2. Vorsitz" },
    { name: "Anette Thielow", role: "Kasse" },
  ],

  villageFacts: {
    intro:
      "[Kurzer Text zur Lage des Dorfes: Landschaft, Nachbarorte, Wahrzeichen und was man hier gesehen haben sollte.]",
    inhabitants: "`~250`",
    firstMentioned: "1253",
    district: "Saale-Holzland-Kreis",
    timeline: [
      { year: "1253", text: "Erste urkundliche Erwähnung" },
      { year: "2025", text: "Gründung des Vereins „Gemeinsam Im Dorf e.V.“" },
    ],
    // Shown as a link only – an embedded map would load third-party content.
    mapLabel: "Dorfgemeinschaftshaus",
    mapUrl: "https://www.openstreetmap.org/",
  },
};

/** Event categories, picked by the event colour in Google Calendar. */
export const eventCategories = {
  feste: { label: "Feste & Kultur" },
  familie: { label: "Kinder & Familie" },
  verein: { label: "Vereinsleben" },
} as const;

export type EventCategory = keyof typeof eventCategories;

// Google Calendar colour IDs: 1 Lavendel, 2 Salbei, 3 Weintraube, 4 Flamingo, 5 Banane,
// 6 Mandarine, 7 Pfau, 8 Graphit, 9 Heidelbeere, 10 Basilikum, 11 Tomate.
// Events without their own colour (calendar default) fall back to `defaultEventCategory`.
export const eventColorToCategory: Record<string, EventCategory> = {
  "1": "feste",
  "7": "feste",
  "9": "feste",
  "2": "familie",
  "10": "familie",
};
export const defaultEventCategory: EventCategory = "verein";

/** Drive subfolder names with a special role. */
export const driveFolders = {
  /** Photos folder → subfolder whose images rotate in the start page header (not shown in the gallery). */
  heroPhotos: "Startseite",
  /** Documents folder → subfolder holding flyers; the newest one is featured on the start page. */
  flyers: "Aushänge",
};
