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

  /** Club account for membership fees and donations. Holder spelled exactly as at the bank (payee name check). */
  bank: {
    holder: "Gemeinsam im Dorf e. V.",
    iban: "DE87830654080005502551",
    bic: "GENODEF1SLR",
    name: "Skatbank",
  },

  address: { street: "Rockau 70", zip: "07619", city: "Schkölen" },
  email: "gemimdo@yahoo.com",
  phone: "0176 64103757",

  /** Club description on the Verein page, one string per paragraph. */
  description: [
    "Wir sind ein gemeinnütziger Verein im Schkölener Ortsteil Rockau. Unser Ziel ist es, das Zusammenleben aller Menschen im Dorf zu gestalten und Angebote für alle Altersgruppen zu schaffen. Erfolgreiche Projekte des letzten Jahres waren die Einrichtung eines Dorftreffs und Jugendclubs mit Bibliothek, ein Sport-, Spaß- und Spielefest, ein Tischkickerturnier und diverse Kreativ- und Bastelnachmittage.",
    "In unserem gemeinnützigen Verein sind alle Menschen willkommen.",
    "Durch die Förderung der Heimatpflege, Heimatkunde und der Ortsverschönerung wollen wir gemeinsam ehrenamtlich tätig werden. Ehrenamt bietet die Möglichkeit, sich aktiv einzubringen und Teil der Gemeinschaft zu werden. Ob bei der Veranstaltung von Dorffesten, in der monatlichen Kaffeerunde, im Jugendclub oder der Bibliothek, bei Arbeitseinsätzen (wie zum Beispiel dem Floßbau und der Reinigung des Dorfteiches), Baumpflanzungen oder den geplanten neuen Projekten.",
  ],
  /** Short version for the "Der Verein" box on the start page. */
  summary:
    "Wir sind ein gemeinnütziger Verein im Schkölener Ortsteil Rockau. Unser Ziel ist es, das Zusammenleben aller Menschen im Dorf zu gestalten und Angebote für alle Altersgruppen zu schaffen. In unserem Verein sind alle Menschen willkommen.",

  board: [
    { name: "Danny Himmelreich", role: "1. Vorsitz", email: "gemimdo@yahoo.com" },
    { name: "Dorothea Roth", role: "2. Vorsitz" },
    { name: "Anett Thielow", role: "Kasse" },
  ],
};

/**
 * Event categories. Each one is its own public Google calendar (IDs in .env:
 * GOOGLE_CALENDAR_FESTE, GOOGLE_CALENDAR_FAMILIE, GOOGLE_CALENDAR_VEREIN).
 */
export const eventCategories = {
  feste: { label: "Feste & Kultur" },
  familie: { label: "Kinder & Familie" },
  verein: { label: "Vereinsleben" },
} as const;

export type EventCategory = keyof typeof eventCategories;

/** Drive subfolder names with a special role. */
export const driveFolders = {
  /** Photos folder → subfolder whose images rotate in the start page header (not shown in the gallery). */
  heroPhotos: "Startseite",
  /** Documents folder → subfolder holding flyers; the newest one is featured on the start page. */
  flyers: "Aushänge",
  /** Documents folder → subfolder whose files are listed in the start page box "Satzung, Formulare & Protokolle". */
  homeDocuments: "Organisation",
};
