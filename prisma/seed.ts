/**
 * Seed de démonstration Ancient Roads.
 * Toutes les dates sont relatives à « maintenant » pour que le tableau de bord
 * (rappels du jour, leads en retard, prochains départs) reste toujours vivant.
 *
 *   npx prisma db seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type {
  ContactStatus,
  Gender,
  InteractionType,
  LicenseType,
  RelationType,
  RiderRole,
  RidingLevel,
  TripFormat,
} from "../src/generated/prisma/enums";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const NOW = new Date();
const DAY = 86_400_000;

/** Date à J+n (négatif = passé), à l'heure donnée (heure locale). */
function day(n: number, hour = 10, minute = 0): Date {
  const d = new Date(NOW.getTime() + n * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}
/** Date « calendaire » (colonnes @db.Date) à J+n. */
function dateOnly(n: number): Date {
  const d = new Date(NOW.getTime() + n * DAY);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
function birth(year: number, month: number, dayOfMonth: number): Date {
  return new Date(Date.UTC(year, month - 1, dayOfMonth));
}
function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "");
}

async function reset() {
  // Ordre inverse des dépendances
  await db.aiAnalysis.deleteMany();
  await db.task.deleteMany();
  await db.interaction.deleteMany();
  await db.tripInterest.deleteMany();
  await db.bookingParticipant.deleteMany();
  await db.booking.deleteMany();
  await db.lead.deleteMany();
  await db.departure.deleteMany();
  await db.trip.deleteMany();
  await db.contactRelationship.deleteMany();
  await db.contact.deleteMany();
  await db.invitation.deleteMany();
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminEmail || !password) {
    throw new Error("ADMIN_EMAIL et ADMIN_INITIAL_PASSWORD doivent être définis dans .env");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  await reset();

  // ───────────── Utilisateurs ─────────────
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "admin" },
    create: { email: adminEmail, name: "Martin Clément", role: "admin", passwordHash },
  });
  const advisorsData = [
    { email: "claire.dubois@ancientroads.test", name: "Claire Dubois" },
    { email: "julien.moreau@ancientroads.test", name: "Julien Moreau" },
    { email: "sofia.benali@ancientroads.test", name: "Sofia Benali" },
  ];
  const [claire, julien, sofia] = await Promise.all(
    advisorsData.map((u) =>
      db.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, role: "conseiller", passwordHash },
      }),
    ),
  );

  // ───────────── Catalogue ─────────────
  type TripSeed = {
    key: string;
    name: string;
    destination: string;
    country: string;
    region?: string;
    durationDays: number;
    level: RidingLevel;
    format: TripFormat;
    motorcycleModel: string;
    basePrice: number;
    description: string;
    active?: boolean;
    departures: { start: number; price?: number; seats: number; status?: "ouvert" | "garanti" | "complet" | "termine" | "annule" }[];
  };

  const tripsData: TripSeed[] = [
    {
      key: "rajasthan", name: "Rajasthan Royal", destination: "Inde", country: "IN", region: "Rajasthan",
      durationDays: 14, level: "intermediaire", format: "guide", motorcycleModel: "Royal Enfield Classic 350", basePrice: 3490,
      description: "Forts, palais et villages du désert du Thar, de Jaipur à Udaipur. Routes asphaltées, trafic dense.",
      departures: [{ start: -330, seats: 10, status: "termine" }, { start: 38, seats: 10, status: "garanti" }, { start: 150, seats: 10 }],
    },
    {
      key: "ladakh", name: "Himalaya : Ladakh & Spiti", destination: "Inde", country: "IN", region: "Ladakh",
      durationDays: 16, level: "confirme", format: "guide", motorcycleModel: "Royal Enfield Himalayan 450", basePrice: 3990,
      description: "Cols à plus de 5 000 m, pistes et gués. Acclimatation progressive à Leh.",
      departures: [{ start: -420, seats: 8, status: "termine" }, { start: 280, seats: 8 }],
    },
    {
      key: "kerala", name: "Kerala & Ghats", destination: "Inde", country: "IN", region: "Kerala",
      durationDays: 12, level: "debutant", format: "guide", motorcycleModel: "Royal Enfield Hunter 350", basePrice: 2890,
      description: "Plantations de thé, backwaters et côte de Malabar. Idéal premier voyage moto lointain.",
      active: false, departures: [{ start: -600, seats: 10, status: "termine" }],
    },
    {
      key: "annapurna", name: "Népal : Annapurna Ride", destination: "Népal", country: "NP", region: "Annapurna",
      durationDays: 13, level: "confirme", format: "guide", motorcycleModel: "Royal Enfield Himalayan 450", basePrice: 3690,
      description: "De Katmandou à Pokhara puis la vallée de la Kali Gandaki. Pistes poussiéreuses et villages tibétains.",
      departures: [{ start: -360, seats: 10, status: "termine" }, { start: 24, seats: 10, status: "complet" }, { start: 390, seats: 10 }],
    },
    {
      key: "mustang", name: "Mustang interdit", destination: "Népal", country: "NP", region: "Upper Mustang",
      durationDays: 15, level: "expert", format: "guide", motorcycleModel: "Royal Enfield Himalayan 450", basePrice: 4490,
      description: "L'ancien royaume de Lo, pistes engagées jusqu'à Lo Manthang. Permis spécial inclus.",
      departures: [{ start: 205, seats: 8 }],
    },
    {
      key: "maroc-sud", name: "Maroc : Grand Sud & Atlas", destination: "Maroc", country: "MA", region: "Haut Atlas",
      durationDays: 10, level: "intermediaire", format: "guide", motorcycleModel: "BMW F 750 GS", basePrice: 2690,
      description: "Marrakech, cols de l'Atlas, gorges du Todra et dunes de Merzouga.",
      departures: [{ start: -560, seats: 12, status: "termine" }, { start: -200, seats: 12, status: "termine" }, { start: 60, seats: 12, status: "garanti" }, { start: 180, seats: 12 }],
    },
    {
      key: "maroc-liberte", name: "Maroc en liberté", destination: "Maroc", country: "MA", region: "Atlas & côte atlantique",
      durationDays: 8, level: "intermediaire", format: "liberte", motorcycleModel: "Honda NX500", basePrice: 1690,
      description: "Roadbook GPS, hébergements réservés, assistance 24/7. Départ chaque samedi.",
      departures: [{ start: -720, seats: 6, status: "termine" }, { start: 45, seats: 6 }, { start: 110, seats: 6 }],
    },
    {
      key: "mongolie", name: "Mongolie : steppes & Gobi", destination: "Mongolie", country: "MN", region: "Gobi",
      durationDays: 15, level: "expert", format: "guide", motorcycleModel: "Honda CRF 300 Rally", basePrice: 4890,
      description: "Hors-piste intégral, nuits en yourte, navigation à vue. Véhicule d'assistance.",
      departures: [{ start: -450, seats: 8, status: "termine" }, { start: 290, seats: 8 }],
    },
    {
      key: "ruta40", name: "Argentine : Ruta 40 & Patagonie", destination: "Argentine", country: "AR", region: "Patagonie",
      durationDays: 18, level: "confirme", format: "guide", motorcycleModel: "BMW R 1300 GS", basePrice: 6290,
      description: "Bariloche, El Chaltén, Perito Moreno. Vent, ripio et grands espaces.",
      departures: [{ start: -240, seats: 10, status: "termine" }, { start: 125, seats: 10, status: "garanti" }, { start: 490, seats: 10 }],
    },
    {
      key: "salta", name: "Argentine : Nord-Ouest andin", destination: "Argentine", country: "AR", region: "Salta & Jujuy",
      durationDays: 12, level: "intermediaire", format: "guide", motorcycleModel: "BMW F 900 GS", basePrice: 4290,
      description: "Quebradas multicolores, salinas et vignobles de Cafayate.",
      departures: [{ start: 160, seats: 10 }],
    },
    {
      key: "alpes", name: "Alpes : cols mythiques", destination: "Europe", country: "FR", region: "Alpes (France, Suisse, Italie)",
      durationDays: 7, level: "intermediaire", format: "guide", motorcycleModel: "BMW R 1300 GS", basePrice: 2190,
      description: "Galibier, Stelvio, Furka, Grimsel. Hôtels de charme au pied des cols.",
      departures: [{ start: -85, seats: 12, status: "termine" }, { start: 270, seats: 12 }],
    },
    {
      key: "corse", name: "Corse en liberté", destination: "Europe", country: "FR", region: "Corse",
      durationDays: 6, level: "intermediaire", format: "liberte", motorcycleModel: "Triumph Tiger 900", basePrice: 1490,
      description: "Le tour de l'île en roadbook : Calanques de Piana, Bavella, Cap Corse.",
      departures: [{ start: -140, seats: 6, status: "termine" }, { start: 235, seats: 6 }],
    },
    {
      key: "ecosse", name: "Écosse : Highlands & NC500", destination: "Europe", country: "GB", region: "Highlands",
      durationDays: 9, level: "debutant", format: "liberte", motorcycleModel: "Triumph Tiger 900", basePrice: 2290,
      description: "La North Coast 500, lochs et distilleries. Conduite à gauche, routes à une voie.",
      departures: [{ start: 255, seats: 6 }],
    },
    {
      key: "balkans", name: "Balkans & Adriatique", destination: "Europe", country: "ME", region: "Croatie, Monténégro, Albanie",
      durationDays: 11, level: "intermediaire", format: "guide", motorcycleModel: "Yamaha Ténéré 700", basePrice: 2990,
      description: "Côte dalmate, bouches de Kotor, montagnes albanaises.",
      departures: [{ start: -25, seats: 10, status: "termine" }, { start: 245, seats: 10 }],
    },
    {
      key: "andalousie", name: "Andalousie sur-mesure", destination: "Europe", country: "ES", region: "Andalousie",
      durationDays: 8, level: "debutant", format: "sur_mesure", motorcycleModel: "BMW F 900 R", basePrice: 2490,
      description: "Itinéraire construit à la carte : villages blancs, Sierra Nevada, Grenade.",
      departures: [{ start: 75, seats: 4 }],
    },
  ];

  const trips: Record<string, { id: string; departures: { id: string; price: number; start: number }[] }> = {};
  for (const t of tripsData) {
    const trip = await db.trip.create({
      data: {
        name: t.name, destination: t.destination, country: t.country, region: t.region,
        durationDays: t.durationDays, level: t.level, format: t.format, motorcycleModel: t.motorcycleModel,
        basePrice: t.basePrice, description: t.description, active: t.active ?? true,
      },
    });
    const deps = [];
    for (const dep of t.departures) {
      const price = dep.price ?? t.basePrice + (dep.start > 0 ? 100 : 0);
      const created = await db.departure.create({
        data: {
          tripId: trip.id,
          startDate: dateOnly(dep.start),
          endDate: dateOnly(dep.start + t.durationDays - 1),
          price,
          seatsTotal: dep.seats,
          seatsLeft: dep.seats,
          status: dep.status ?? "ouvert",
        },
      });
      deps.push({ id: created.id, price, start: dep.start });
    }
    trips[t.key] = { id: trip.id, departures: deps };
  }
  /** Départ d'un séjour : index dans la liste ci-dessus. */
  const dep = (key: string, i: number) => trips[key].departures[i];

  // ───────────── Contacts ─────────────
  type ContactSeed = {
    key: string;
    gender: Gender;
    first: string;
    last: string;
    born: [number, number, number];
    city: string;
    postal: string;
    status: ContactStatus;
    owner: { id: string };
    rider?: RiderRole;
    license?: LicenseType;
    licenseYear?: number;
    level?: RidingLevel;
    height?: number;
    diet?: string;
    notes?: string;
    newsletter?: boolean;
    sms?: boolean;
    country?: string;
  };

  const contactsData: ContactSeed[] = [
    // Groupe Garnier & Petit — fidèles, Maroc 2024, Rajasthan 2025, Alpes 2026
    { key: "philippe", gender: "homme", first: "Philippe", last: "Garnier", born: [1964, 4, 12], city: "Annecy", postal: "74000", status: "fidele", owner: claire,
      rider: "pilote", license: "A", licenseYear: 1985, level: "confirme", height: 182,
      notes: "Ancien cadre chez un équipementier, retraité depuis 2024. Voyage toujours avec son épouse Nathalie (passagère). Rêve de l'Argentine « avant 65 ans ». Préfère les hôtels avec un peu de confort, pas de bivouac.",
      newsletter: true, sms: true },
    { key: "nathalie", gender: "femme", first: "Nathalie", last: "Garnier", born: [1966, 9, 3], city: "Annecy", postal: "74000", status: "fidele", owner: claire,
      rider: "passager", level: "debutant", height: 165, diet: "Végétarienne",
      notes: "Passagère. Photographe amateur, demande des arrêts photo. Sensible au froid : éviter la haute altitude en début de saison.", newsletter: true },
    { key: "laurent", gender: "homme", first: "Laurent", last: "Petit", born: [1962, 1, 27], city: "Chambéry", postal: "73000", status: "client", owner: claire,
      rider: "pilote", license: "A", licenseYear: 1982, level: "expert", height: 178,
      notes: "Ami de longue date de Philippe Garnier. Roule en trail, très bon niveau tout-terrain. Hésite entre Mongolie et Mustang pour 2027.", newsletter: true },

    // Bande des Lyonnais — Mongolie 2025 ; Marc & Karim Ruta 40 2026
    { key: "marc", gender: "homme", first: "Marc", last: "Rousseau", born: [1975, 6, 18], city: "Lyon", postal: "69003", status: "fidele", owner: julien,
      rider: "pilote", license: "A", licenseYear: 1996, level: "expert", height: 185,
      notes: "Leader du groupe de 4 amis lyonnais. Organise et paie souvent pour le groupe. Veut du hors-piste, déteste les itinéraires « trop touristiques ».", newsletter: true, sms: true },
    { key: "thierry", gender: "homme", first: "Thierry", last: "Lefebvre", born: [1973, 11, 2], city: "Villeurbanne", postal: "69100", status: "client", owner: julien,
      rider: "pilote", license: "A", licenseYear: 1994, level: "confirme", height: 176, newsletter: true },
    { key: "olivier", gender: "homme", first: "Olivier", last: "Fontaine", born: [1977, 3, 9], city: "Lyon", postal: "69007", status: "client", owner: julien,
      rider: "pilote", license: "A", licenseYear: 2001, level: "confirme", height: 190,
      notes: "Grand gabarit : vérifier la hauteur de selle. A eu une chute en Mongolie (sans gravité), un peu refroidi depuis.", newsletter: false },
    { key: "karim", gender: "homme", first: "Karim", last: "Haddad", born: [1979, 8, 24], city: "Caluire-et-Cuire", postal: "69300", status: "fidele", owner: julien,
      rider: "pilote", license: "A", licenseYear: 2003, level: "expert", height: 174, diet: "Sans porc",
      newsletter: true, sms: true },

    // Famille Marchand — Népal 2025 (Bruno & Isabelle), Alpes 2026 avec leur fils
    { key: "bruno", gender: "homme", first: "Bruno", last: "Marchand", born: [1968, 2, 14], city: "Nantes", postal: "44000", status: "fidele", owner: sofia,
      rider: "pilote", license: "A", licenseYear: 1990, level: "confirme", height: 180,
      notes: "Médecin. Disponible surtout en avril-mai et octobre. Veut emmener son fils Hugo sur un voyage lointain en 2027.", newsletter: true },
    { key: "isabelle", gender: "femme", first: "Isabelle", last: "Marchand", born: [1970, 7, 30], city: "Nantes", postal: "44000", status: "fidele", owner: sofia,
      rider: "passager", level: "intermediaire", height: 168, newsletter: true },
    { key: "hugo", gender: "homme", first: "Hugo", last: "Marchand", born: [1999, 12, 5], city: "Rennes", postal: "35000", status: "client", owner: sofia,
      rider: "pilote", license: "A2", licenseYear: 2021, level: "intermediaire", height: 183,
      notes: "Permis A2 : vérifier les motos compatibles (bridage).", newsletter: false, sms: true },

    // Sophie & Émilie — amies pilotes, Maroc liberté 2024, Corse 2026
    { key: "sophie", gender: "femme", first: "Sophie", last: "Lambert", born: [1985, 5, 21], city: "Bordeaux", postal: "33000", status: "client", owner: claire,
      rider: "pilote", license: "A", licenseYear: 2012, level: "confirme", height: 167,
      notes: "Préfère les formules liberté. Intéressée par un premier voyage guidé lointain si groupe mixte.", newsletter: true },
    { key: "emilie", gender: "femme", first: "Émilie", last: "Roux", born: [1987, 10, 11], city: "Bordeaux", postal: "33800", status: "client", owner: claire,
      rider: "pilote", license: "A", licenseYear: 2015, level: "intermediaire", height: 162, diet: "Sans gluten", newsletter: true },

    // Couple Bernard — Balkans septembre 2026
    { key: "antoine", gender: "homme", first: "Antoine", last: "Bernard", born: [1981, 3, 3], city: "Strasbourg", postal: "67000", status: "client", owner: sofia,
      rider: "pilote", license: "A", licenseYear: 2006, level: "intermediaire", height: 179,
      notes: "Rentré des Balkans fin septembre, très satisfait (retour à recueillir).", newsletter: true },
    { key: "camille", gender: "femme", first: "Camille", last: "Bernard", born: [1983, 8, 19], city: "Strasbourg", postal: "67000", status: "client", owner: sofia,
      rider: "passager", height: 170, newsletter: true },

    // Clients ponctuels
    { key: "francois", gender: "homme", first: "François", last: "Mercier", born: [1958, 12, 1], city: "Grenoble", postal: "38000", status: "inactif", owner: julien,
      rider: "pilote", license: "A", licenseYear: 1978, level: "confirme", height: 175,
      notes: "Kerala 2024. A annulé son Ladakh pour raisons de santé. Ne souhaite plus être relancé par téléphone.", newsletter: false },
    { key: "pascale", gender: "femme", first: "Pascale", last: "Dupont", born: [1971, 4, 8], city: "Toulouse", postal: "31000", status: "client", owner: claire,
      rider: "pilote", license: "A", licenseYear: 2009, level: "confirme", height: 171,
      notes: "Ruta 40 en 2026, a voyagé seule dans le groupe. Très bon contact avec le guide Diego.", newsletter: true },
    { key: "yannick", gender: "homme", first: "Yannick", last: "Le Gall", born: [1980, 6, 6], city: "Brest", postal: "29200", status: "client", owner: sofia,
      rider: "pilote", license: "A", licenseYear: 2004, level: "intermediaire", height: 177, newsletter: true },
    { key: "gilles", gender: "homme", first: "Gilles", last: "Chevalier", born: [1960, 9, 15], city: "Dijon", postal: "21000", status: "client", owner: julien,
      rider: "pilote", license: "A", licenseYear: 1980, level: "confirme", height: 181,
      notes: "Option posée sur le Rajasthan de novembre, attend l'accord de sa femme pour venir en passagère.", newsletter: true },

    // Prospects
    { key: "julie", gender: "femme", first: "Julie", last: "Martin", born: [1990, 2, 17], city: "Paris", postal: "75011", status: "prospect", owner: claire,
      rider: "pilote", license: "A2", licenseYear: 2023, level: "debutant", height: 160,
      notes: "Permis récent. Cherche un premier voyage encadré, budget serré (~2 500 €).", newsletter: true },
    { key: "nicolas", gender: "homme", first: "Nicolas", last: "Girard", born: [1984, 7, 4], city: "Lille", postal: "59000", status: "prospect", owner: julien,
      rider: "pilote", license: "A", licenseYear: 2008, level: "confirme", height: 184,
      notes: "Vu au salon Moto Légende. Veut la Mongolie en 2027 avec 2 collègues.", newsletter: true },
    { key: "sandrine", gender: "femme", first: "Sandrine", last: "Faure", born: [1976, 1, 30], city: "Montpellier", postal: "34000", status: "prospect", owner: sofia,
      rider: "passager", height: 164, notes: "Cherche un voyage en passagère avec son compagnon (pas encore en base).", newsletter: true },
    { key: "david", gender: "homme", first: "David", last: "Blanc", born: [1972, 10, 22], city: "Marseille", postal: "13008", status: "prospect", owner: claire,
      rider: "pilote", license: "A", licenseYear: 1995, level: "expert", height: 186, newsletter: false },
    { key: "eric", gender: "homme", first: "Éric", last: "Guerin", born: [1969, 5, 13], city: "Clermont-Ferrand", postal: "63000", status: "prospect", owner: julien,
      rider: "pilote", license: "A", licenseYear: 1990, level: "intermediaire", height: 173, newsletter: true },
    { key: "valerie", gender: "femme", first: "Valérie", last: "Perrin", born: [1978, 11, 28], city: "Tours", postal: "37000", status: "prospect", owner: sofia,
      rider: "pilote", license: "A", licenseYear: 2018, level: "intermediaire", height: 166, newsletter: true, sms: true },
    { key: "thomas", gender: "homme", first: "Thomas", last: "Robin", born: [1993, 3, 25], city: "Nice", postal: "06000", status: "prospect", owner: claire,
      rider: "pilote", license: "A", licenseYear: 2016, level: "confirme", height: 180, newsletter: true },
    { key: "christophe", gender: "homme", first: "Christophe", last: "Morel", born: [1966, 8, 8], city: "Reims", postal: "51100", status: "prospect", owner: julien,
      rider: "pilote", license: "A", licenseYear: 1988, level: "confirme", height: 178,
      notes: "Trouve nos prix élevés par rapport à un concurrent. Objection prix non levée.", newsletter: true },
    { key: "aurelie", gender: "femme", first: "Aurélie", last: "Simon", born: [1988, 6, 14], city: "Genève", postal: "1201", status: "prospect", owner: sofia, country: "CH",
      rider: "pilote", license: "A", licenseYear: 2014, level: "confirme", height: 169, newsletter: true },
    { key: "stephane", gender: "homme", first: "Stéphane", last: "Michel", born: [1974, 12, 19], city: "Metz", postal: "57000", status: "prospect", owner: julien,
      rider: "pilote", license: "A", licenseYear: 1999, level: "intermediaire", height: 175, newsletter: false },
    { key: "helene", gender: "femme", first: "Hélène", last: "Lucas", born: [1961, 4, 2], city: "Bruxelles", postal: "1000", status: "prospect", owner: claire, country: "BE",
      rider: "passager", height: 163, newsletter: true },
    { key: "romain", gender: "homme", first: "Romain", last: "Henry", born: [1995, 9, 9], city: "Angers", postal: "49000", status: "prospect", owner: sofia,
      rider: "pilote", license: "A2", licenseYear: 2022, level: "debutant", height: 182, newsletter: true },
  ];

  const contacts: Record<string, { id: string }> = {};
  let phoneSeq = 10;
  for (const c of contactsData) {
    phoneSeq += 1;
    const created = await db.contact.create({
      data: {
        gender: c.gender,
        firstName: c.first,
        lastName: c.last,
        birthDate: birth(...c.born),
        email: `${slug(c.first)}.${slug(c.last)}@example.com`,
        phoneMobile: c.country === "CH" ? `+417912345${phoneSeq}` : c.country === "BE" ? `+3247012345${phoneSeq % 10}` : `+336123456${phoneSeq}`,
        phoneHome: c.status === "fidele" ? `+334501234${phoneSeq}` : null,
        addressLine: `${(phoneSeq * 7) % 120 + 1} rue ${["des Lilas", "Victor Hugo", "de la République", "du Moulin", "Pasteur"][phoneSeq % 5]}`,
        postalCode: c.postal,
        city: c.city,
        country: c.country ?? "FR",
        status: c.status,
        ownerUserId: c.owner.id,
        riderRole: c.rider,
        licenseType: c.license ?? (c.rider === "passager" ? "aucun" : undefined),
        licenseDate: c.licenseYear ? birth(c.licenseYear, 6, 15) : null,
        ridingLevel: c.level,
        heightCm: c.height,
        diet: c.diet,
        freeNotes: c.notes,
        newsletterOptin: c.newsletter ?? false,
        smsOptin: c.sms ?? false,
        consentDate: c.newsletter || c.sms ? day(-400 - phoneSeq * 3) : null,
      },
    });
    contacts[c.key] = created;
  }
  const C = (k: string) => contacts[k].id;

  // ───────────── Relations ─────────────
  const relations: [string, string, RelationType][] = [
    ["philippe", "nathalie", "conjoint"],
    ["philippe", "laurent", "ami"],
    ["marc", "thierry", "ami"],
    ["marc", "olivier", "ami"],
    ["marc", "karim", "ami"],
    ["bruno", "isabelle", "conjoint"],
    ["bruno", "hugo", "enfant"],
    ["isabelle", "hugo", "enfant"],
    ["sophie", "emilie", "ami"],
    ["antoine", "camille", "conjoint"],
  ];
  for (const [a, b, relation] of relations) {
    await db.contactRelationship.create({ data: { contactId: C(a), relatedContactId: C(b), relation } });
  }

  // ───────────── Réservations ─────────────
  type P = [string, RiderRole];
  async function book(
    departure: { id: string; price: number; start: number },
    payer: string,
    participants: P[],
    status: "option" | "confirme" | "solde" | "annule",
    bookedDaysBeforeStart = 120,
  ) {
    const rows = participants.map(([key, role]) => ({
      contactId: C(key),
      role,
      amount: role === "passager" ? Math.round(departure.price * 0.65) : departure.price,
    }));
    const total = rows.reduce((s, r) => s + r.amount, 0);
    await db.booking.create({
      data: {
        departureId: departure.id,
        payerContactId: C(payer),
        totalAmount: total,
        status,
        bookedAt: day(Math.min(departure.start - bookedDaysBeforeStart, -2)),
        participants: { create: rows },
      },
    });
    if (status !== "annule") {
      await db.departure.update({ where: { id: departure.id }, data: { seatsLeft: { decrement: rows.length } } });
    }
  }

  // Garnier & Petit
  await book(dep("maroc-sud", 0), "philippe", [["philippe", "pilote"], ["nathalie", "passager"]], "solde");
  await book(dep("maroc-sud", 0), "laurent", [["laurent", "pilote"]], "solde");
  await book(dep("rajasthan", 0), "philippe", [["philippe", "pilote"], ["nathalie", "passager"], ["laurent", "pilote"]], "solde");
  await book(dep("alpes", 0), "philippe", [["philippe", "pilote"], ["nathalie", "passager"]], "solde", 90);
  // Lyonnais
  await book(dep("mongolie", 0), "marc", [["marc", "pilote"], ["thierry", "pilote"], ["olivier", "pilote"], ["karim", "pilote"]], "solde");
  await book(dep("ruta40", 0), "marc", [["marc", "pilote"]], "solde");
  await book(dep("ruta40", 0), "karim", [["karim", "pilote"]], "solde");
  await book(dep("maroc-sud", 1), "karim", [["karim", "pilote"]], "solde");
  // Marchand
  await book(dep("annapurna", 0), "bruno", [["bruno", "pilote"], ["isabelle", "passager"]], "solde");
  await book(dep("alpes", 0), "bruno", [["bruno", "pilote"], ["isabelle", "passager"], ["hugo", "pilote"]], "solde", 100);
  await book(dep("ladakh", 0), "bruno", [["bruno", "pilote"]], "solde");
  // Sophie & Émilie
  await book(dep("maroc-liberte", 0), "sophie", [["sophie", "pilote"], ["emilie", "pilote"]], "solde");
  await book(dep("corse", 0), "emilie", [["emilie", "pilote"], ["sophie", "pilote"]], "solde");
  // Bernard
  await book(dep("balkans", 0), "antoine", [["antoine", "pilote"], ["camille", "passager"]], "solde");
  // Ponctuels
  await book(dep("kerala", 0), "francois", [["francois", "pilote"]], "solde");
  await book(dep("ladakh", 0), "francois", [["francois", "pilote"]], "annule");
  await book(dep("ruta40", 0), "pascale", [["pascale", "pilote"]], "solde");
  await book(dep("maroc-sud", 1), "yannick", [["yannick", "pilote"]], "solde");
  await book(dep("rajasthan", 1), "gilles", [["gilles", "pilote"]], "option", 20);
  // Départs à venir déjà vendus
  await book(dep("annapurna", 1), "laurent", [["laurent", "pilote"]], "confirme", 150);
  await book(dep("maroc-sud", 2), "yannick", [["yannick", "pilote"]], "confirme", 40);
  await book(dep("ruta40", 1), "philippe", [["philippe", "pilote"], ["nathalie", "passager"]], "option", 130);

  // ───────────── Intérêts ─────────────
  const interests: { c: string; trip?: string; destination?: string; source: "formulaire" | "appel" | "email" | "salon" | "newsletter" | "conseiller"; level: "faible" | "moyen" | "fort"; period?: string; budget?: number; ago: number }[] = [
    { c: "philippe", trip: "ruta40", source: "appel", level: "fort", period: "Printemps 2027", budget: 13000, ago: 20 },
    { c: "laurent", trip: "mongolie", source: "appel", level: "moyen", period: "Été 2027", ago: 35 },
    { c: "laurent", trip: "mustang", source: "newsletter", level: "moyen", period: "2027", ago: 12 },
    { c: "marc", trip: "mustang", source: "email", level: "fort", period: "Printemps 2027", ago: 9 },
    { c: "thierry", trip: "mustang", source: "conseiller", level: "faible", ago: 9 },
    { c: "karim", trip: "salta", source: "newsletter", level: "moyen", period: "Mars 2027", ago: 15 },
    { c: "bruno", trip: "rajasthan", source: "appel", level: "fort", period: "Avril 2027", budget: 9000, ago: 6 },
    { c: "hugo", destination: "Amérique du Sud", source: "formulaire", level: "faible", ago: 60 },
    { c: "sophie", trip: "salta", source: "formulaire", level: "moyen", period: "2027", ago: 25 },
    { c: "emilie", trip: "ecosse", source: "newsletter", level: "moyen", period: "Été 2027", ago: 18 },
    { c: "antoine", destination: "Islande", source: "appel", level: "faible", ago: 4 },
    { c: "pascale", trip: "salta", source: "appel", level: "fort", period: "Novembre 2026 ou mars 2027", budget: 5000, ago: 10 },
    { c: "gilles", trip: "rajasthan", source: "appel", level: "fort", period: "Novembre 2026", ago: 22 },
    { c: "julie", trip: "maroc-liberte", source: "formulaire", level: "moyen", period: "Printemps 2027", budget: 2500, ago: 3 },
    { c: "julie", trip: "ecosse", source: "formulaire", level: "faible", ago: 3 },
    { c: "nicolas", trip: "mongolie", source: "salon", level: "fort", period: "Été 2027", budget: 6000, ago: 40 },
    { c: "sandrine", destination: "Maroc", source: "formulaire", level: "moyen", period: "Automne", ago: 14 },
    { c: "david", trip: "mustang", source: "formulaire", level: "fort", period: "Dès que possible", ago: 1 },
    { c: "eric", trip: "alpes", source: "newsletter", level: "moyen", period: "Été 2027", ago: 30 },
    { c: "valerie", trip: "corse", source: "formulaire", level: "fort", period: "Juin 2027", budget: 2000, ago: 2 },
    { c: "thomas", trip: "ladakh", source: "formulaire", level: "moyen", period: "Été 2027", ago: 50 },
    { c: "christophe", trip: "maroc-sud", source: "appel", level: "moyen", period: "Printemps", budget: 2200, ago: 45 },
    { c: "aurelie", trip: "ruta40", source: "email", level: "moyen", period: "Février 2027", ago: 8 },
    { c: "stephane", destination: "Vietnam", source: "salon", level: "faible", ago: 120 },
    { c: "helene", trip: "andalousie", source: "formulaire", level: "moyen", period: "Mai 2027", ago: 5 },
    { c: "romain", trip: "maroc-liberte", source: "newsletter", level: "faible", ago: 70 },
  ];
  for (const i of interests) {
    await db.tripInterest.create({
      data: {
        contactId: C(i.c),
        tripId: i.trip ? trips[i.trip].id : null,
        destination: i.destination ?? null,
        source: i.source,
        level: i.level,
        periodWanted: i.period,
        budget: i.budget,
        createdAt: day(-i.ago),
      },
    });
  }

  // ───────────── Interactions ─────────────
  type I = [string, InteractionType, number, string, string, { id: string } | null, Record<string, string | boolean>?];
  const interactions: I[] = [
    ["philippe", "call_in", -20, "Projet Argentine 2027", "Appelle pour la Ruta 40 au printemps 2027 avec Nathalie. Budget ~13 k€ pour deux. Veut savoir si la R 1300 GS est adaptée en duo sur ripio.", claire],
    ["philippe", "email_out", -19, "Devis Ruta 40 — duo", "Envoi du devis pilote + passagère, départ de février.", claire],
    ["philippe", "newsletter_open", -12, "Newsletter octobre", "", null, { campaign: "newsletter-octobre" }],
    ["philippe", "call_out", -5, "Relance devis Argentine", "Option posée. Attend la confirmation de ses dates de retraite anticipée de Nathalie. Rappeler la semaine prochaine.", claire],
    ["nathalie", "email_in", -18, "Question altitude", "Demande les altitudes max sur la Ruta 40 (craint le froid).", claire],
    ["laurent", "call_out", -35, "Bilan Rajasthan + suite", "Très content du Rajasthan. Hésite Mongolie / Mustang. Préfère l'été.", claire],
    ["laurent", "newsletter_click", -12, "Mustang interdit", "", null, { campaign: "newsletter-octobre", link: "/sejours/mustang" }],
    ["marc", "email_in", -9, "Mustang pour 4 ?", "Demande si le Mustang peut être privatisé pour son groupe de 4 au printemps 2027.", julien],
    ["marc", "call_out", -7, "Mustang groupe", "Explique le permis spécial. Marc veut des dates d'avril. Olivier pas sûr de venir.", julien],
    ["marc", "newsletter_open", -12, "Newsletter octobre", "", null, { campaign: "newsletter-octobre" }],
    ["thierry", "newsletter_sent", -12, "Newsletter octobre", "", null, { campaign: "newsletter-octobre" }],
    ["olivier", "call_out", -60, "Suivi après chute Mongolie", "Va bien. Pas prêt à repartir sur du hors-piste engagé. Laisser revenir.", julien],
    ["olivier", "newsletter_sent", -12, "Newsletter octobre", "", null, { campaign: "newsletter-octobre", unsubscribed: true }],
    ["karim", "newsletter_click", -15, "Nord-Ouest andin", "", null, { campaign: "newsletter-septembre", link: "/sejours/salta" }],
    ["karim", "call_in", -14, "Infos Salta", "Intéressé par Salta en mars 2027, voudrait que Marc vienne aussi.", julien],
    ["bruno", "call_in", -6, "Rajasthan avec Hugo", "Veut le Rajasthan d'avril 2027 avec Isabelle et Hugo. Demande si Hugo peut piloter en A2 : à vérifier.", sofia],
    ["bruno", "email_out", -5, "Infos A2 Rajasthan", "Confirmation que la Classic 350 est compatible A2. Devis à faire pour 3.", sofia],
    ["isabelle", "meeting", -40, "Soirée retour Népal", "Venue à la soirée clients, a montré ses photos. Très enthousiaste.", sofia],
    ["hugo", "email_in", -60, "Voyages Amérique du Sud", "Demande d'infos générales.", sofia],
    ["sophie", "call_out", -25, "Après Corse", "Corse top. Envie d'un guidé lointain en 2027, groupe mixte important pour elle.", claire],
    ["emilie", "newsletter_open", -18, "Newsletter septembre", "", null, { campaign: "newsletter-septembre" }],
    ["antoine", "call_out", -4, "Retour Balkans", "Très satisfait, note 9/10. Parle de l'Islande pour plus tard. Camille aimerait moins de km par jour.", sofia],
    ["francois", "call_out", -210, "Annulation Ladakh", "Annule pour raisons de santé. Remboursé selon CGV. Ne souhaite plus d'appels.", julien],
    ["pascale", "call_in", -10, "Salta", "Veut Salta en novembre ou mars. Demande s'il reste des places en solo sans supplément single.", claire],
    ["pascale", "email_out", -9, "Devis Salta", "Devis envoyé avec supplément single 450 €.", claire],
    ["yannick", "email_out", -30, "Convocation Maroc", "Carnet de voyage envoyé pour le Grand Sud de novembre.", sofia],
    ["gilles", "call_in", -22, "Option Rajasthan", "Pose une option sur le départ de novembre. Sa femme hésite à venir en passagère.", julien],
    ["gilles", "call_out", -8, "Relance option", "Pas encore de réponse de son épouse. Option expire bientôt.", julien],
    ["julie", "callback", -3, "Demande de rappel", "Demande de rappel via le site : premier voyage, permis A2.", null],
    ["julie", "call_out", -2, "Premier échange", "Budget 2 500 €. Le Maroc en liberté l'intéresse mais elle a peur de rouler seule. Envoyer les dates du Grand Sud.", claire],
    ["nicolas", "fair", -40, "Salon Moto Légende", "Rencontré sur le stand. Projet Mongolie 2027 avec 2 collègues.", julien],
    ["nicolas", "email_out", -38, "Doc Mongolie", "Envoi de la brochure et du programme.", julien],
    ["sandrine", "email_in", -14, "Voyage en duo", "Cherche un voyage où elle serait passagère, compagnon pilote expérimenté.", sofia],
    ["david", "email_in", -1, "Mustang", "Formulaire site : veut le Mustang au plus vite, pilote expert.", null],
    ["eric", "newsletter_click", -30, "Alpes", "", null, { campaign: "newsletter-septembre", link: "/sejours/alpes" }],
    ["valerie", "email_in", -2, "Corse juin", "Demande de dispo pour la Corse en juin 2027, 1 pilote.", null],
    ["thomas", "call_out", -48, "Ladakh", "Messagerie.", sofia],
    ["thomas", "call_out", -41, "Ladakh", "Messagerie, message laissé.", sofia],
    ["thomas", "call_out", -33, "Ladakh", "Ne répond pas. 3e tentative.", sofia],
    ["christophe", "call_in", -45, "Prix Maroc", "Trouve le Grand Sud 400 € plus cher qu'un concurrent. Explique la différence (motos récentes, assistance, petits groupes). Pas convaincu.", julien],
    ["christophe", "email_out", -44, "Comparatif", "Envoi du détail des prestations incluses.", julien],
    ["aurelie", "email_in", -8, "Ruta 40", "Demande si les motos sont abaissables (1m69).", sofia],
    ["stephane", "fair", -120, "Salon de Metz", "Intérêt vague pour l'Asie du Sud-Est.", julien],
    ["helene", "email_in", -5, "Andalousie", "Cherche un sur-mesure en passagère avec son mari (belge, pas en base).", claire],
    ["romain", "newsletter_open", -70, "Newsletter juillet", "", null, { campaign: "newsletter-juillet" }],
  ];
  for (const [c, type, n, subject, summary, user, metadata] of interactions) {
    const direction = ["call_in", "email_in", "callback", "newsletter_open", "newsletter_click"].includes(type)
      ? "entrant"
      : ["call_out", "email_out", "newsletter_sent"].includes(type)
        ? "sortant"
        : null;
    await db.interaction.create({
      data: {
        contactId: C(c),
        type,
        direction,
        subject,
        summary: summary || null,
        userId: user?.id ?? null,
        occurredAt: day(n, 9 + (Math.abs(n) % 8), (Math.abs(n) * 7) % 60),
        metadata: metadata ?? undefined,
      },
    });
  }
  await db.contact.update({ where: { id: C("olivier") }, data: { newsletterOptin: false } });

  // ───────────── Leads ─────────────
  const leads = [
    // Nouveaux
    { channel: "callback" as const, first: "Mathieu", last: "Lemaire", email: "mathieu.lemaire@example.com", phone: "+33645879012", slot: "12h-14h", at: day(0, 12, 30), trip: "maroc-sud", msg: "Je voudrais des infos sur le Grand Sud de novembre.", ago: 0.2, utm: ["google", "maroc-automne"] },
    { channel: "email_form" as const, first: "Claire", last: "Vidal", email: "claire.vidal@example.com", phone: null, trip: "ecosse", msg: "Est-ce adapté à une première expérience de conduite à gauche ?", ago: 2, utm: ["instagram", "ecosse-2027"] },
    { channel: "callback" as const, first: "Patrick", last: "Noël", email: null, phone: "+33678451236", slot: "18h-20h", at: day(0, 18, 0), trip: null, msg: "Rappel souhaité", ago: 1.5, utm: ["facebook", "brand"] },
    { channel: "email_form" as const, first: "Valérie", last: "Perrin", email: "valerie.perrin@example.com", phone: null, trip: "corse", msg: "Disponibilité Corse juin 2027 ?", ago: 2, utm: ["newsletter", "newsletter-septembre"], contact: "valerie" },
    { channel: "email_form" as const, first: "David", last: "Blanc", email: "DAVID.BLANC@example.com", phone: null, trip: "mustang", msg: "Pilote expert, je veux le Mustang au plus vite.", ago: 1, utm: ["google", "mustang"] },
    // En cours
    { channel: "callback" as const, first: "Julie", last: "Martin", email: "julie.martin@example.com", phone: "+33612345630", slot: "9h-12h", at: day(-3, 10), trip: "maroc-liberte", msg: "Premier voyage moto", ago: 3, utm: ["google", "debutant"], contact: "julie", status: "qualification" as const, user: claire },
    { channel: "inbound_call" as const, first: "Pascale", last: "Dupont", email: "pascale.dupont@example.com", phone: null, trip: "salta", msg: "Salta solo", ago: 10, contact: "pascale", status: "devis_envoye" as const, user: claire },
    { channel: "email_form" as const, first: "Aurélie", last: "Simon", email: "aurelie.simon@example.com", phone: null, trip: "ruta40", msg: "Motos abaissables ?", ago: 8, contact: "aurelie", status: "qualification" as const, user: sofia },
    // Clos
    { channel: "inbound_call" as const, first: "Laurent", last: "Petit", email: "laurent.petit@example.com", phone: null, trip: "annapurna", msg: "", ago: 170, contact: "laurent", status: "gagne" as const, user: claire },
    { channel: "email_form" as const, first: "Christophe", last: "Morel", email: "christophe.morel@example.com", phone: null, trip: "maroc-sud", msg: "Tarif ?", ago: 46, contact: "christophe", status: "perdu" as const, user: julien, lost: "Prix jugé trop élevé (concurrent moins cher)" },
    { channel: "callback" as const, first: "Thomas", last: "Robin", email: "thomas.robin@example.com", phone: "+33612345636", slot: "14h-17h", at: day(-48, 15), trip: "ladakh", msg: "", ago: 49, contact: "thomas", status: "injoignable" as const, user: sofia },
  ];
  const createdLeads: Record<string, string> = {};
  for (const l of leads) {
    const lead = await db.lead.create({
      data: {
        channel: l.channel,
        firstName: l.first,
        lastName: l.last,
        email: l.email?.toLowerCase() ?? null,
        phone: l.phone,
        callbackSlot: "slot" in l ? l.slot : null,
        callbackAt: "at" in l ? l.at : null,
        tripId: l.trip ? trips[l.trip].id : null,
        message: l.msg || null,
        utmSource: l.utm?.[0],
        utmCampaign: l.utm?.[1],
        status: "status" in l ? l.status : "nouveau",
        lostReason: "lost" in l ? l.lost : null,
        assignedUserId: "user" in l && l.user ? l.user.id : null,
        contactId: "contact" in l && l.contact ? C(l.contact) : null,
        createdAt: new Date(NOW.getTime() - l.ago * DAY),
      },
    });
    createdLeads[`${l.first} ${l.last}`] = lead.id;
  }

  // ───────────── Tâches ─────────────
  const tasks = [
    { c: null, lead: "Mathieu Lemaire", type: "rappel" as const, title: "Rappel demandé (12h-14h)", due: day(0, 12, 30), user: julien },
    { c: null, lead: "Patrick Noël", type: "rappel" as const, title: "Rappel demandé (18h-20h)", due: day(0, 18, 0), user: sofia },
    { c: "philippe", type: "relance" as const, title: "Relancer l'option Ruta 40", due: day(0, 9, 30), user: claire },
    { c: "gilles", type: "relance" as const, title: "Option Rajasthan : réponse de son épouse ?", due: day(0, 11, 0), user: julien },
    { c: "bruno", type: "devis" as const, title: "Devis Rajasthan avril pour 3", due: day(0, 15, 0), user: sofia },
    { c: "marc", type: "rappel" as const, title: "Proposer des dates Mustang pour 4", due: day(0, 16, 30), user: julien },
    { c: "pascale", type: "relance" as const, title: "Relance devis Salta", due: day(-1, 10, 0), user: claire },
    { c: "julie", type: "autre" as const, title: "Envoyer dates Grand Sud", due: day(1, 10, 0), user: claire },
    { c: "nicolas", type: "relance" as const, title: "Relance Mongolie 2027", due: day(3, 14, 0), user: julien },
    { c: "antoine", type: "autre" as const, title: "Envoyer questionnaire satisfaction Balkans", due: day(2, 9, 0), user: sofia },
    { c: "laurent", type: "rappel" as const, title: "Point préparation Annapurna", due: day(-10, 10, 0), user: claire, done: day(-10, 10, 20) },
  ];
  for (const t of tasks) {
    await db.task.create({
      data: {
        contactId: t.c ? C(t.c) : null,
        leadId: "lead" in t && t.lead ? createdLeads[t.lead] : null,
        type: t.type,
        title: t.title,
        dueAt: t.due,
        doneAt: "done" in t ? t.done : null,
        assignedUserId: t.user.id,
      },
    });
  }

  // ───────────── Analyses IA de démonstration ─────────────
  const demoAnalyses: [string, number, string][] = [
    ["philippe", 82, "Client fidèle (3 voyages), option posée sur la Ruta 40, budget annoncé cohérent. Il attend seulement la validation des dates."],
    ["bruno", 76, "Fidèle, projet Rajasthan précis (avril 2027, 3 personnes). Le devis est à envoyer rapidement."],
    ["marc", 71, "Leader d'un groupe fidèle. Il demande le Mustang pour 4 au printemps, mais la participation d'Olivier est incertaine."],
    ["gilles", 64, "Option sur le Rajasthan de novembre. Il manque la décision de son épouse et l'option expire bientôt."],
    ["pascale", 61, "Devis Salta envoyé. Le supplément single est un point de friction possible."],
    ["karim", 55, "Fidèle, intérêt Salta en mars sans démarche concrète pour l'instant."],
    ["laurent", 52, "Déjà inscrit à l'Annapurna. Il hésite entre Mongolie et Mustang pour 2027."],
    ["nicolas", 47, "Prospect de salon motivé (Mongolie 2027), mais pas de nouvelle depuis 5 semaines."],
    ["sophie", 44, "Cliente satisfaite, envie d'un guidé lointain en 2027 sans destination arrêtée."],
    ["julie", 38, "Prospect débutante, budget serré. Elle a besoin d'être rassurée sur le format."],
    ["christophe", 18, "Objection prix non levée, aucun contact depuis 6 semaines."],
    ["thomas", 12, "Injoignable après 3 tentatives."],
  ];
  const levelOf = (s: number) => (s >= 75 ? "pret_a_reserver" : s >= 50 ? "chaud" : s >= 25 ? "tiede" : "froid") as "froid" | "tiede" | "chaud" | "pret_a_reserver";
  for (const [k, score, summary] of demoAnalyses) {
    const createdAt = day(-1, 8, 30);
    const result = {
      score,
      level: { froid: "Froid", tiede: "Tiède", chaud: "Chaud", pret_a_reserver: "Prêt à réserver" }[levelOf(score)],
      score_breakdown: [
        { dimension: "Engagement récent", points: Math.round(score * 0.25), max: 25, reason: "Données de démonstration" },
        { dimension: "Précision du projet", points: Math.round(score * 0.25), max: 25, reason: "Données de démonstration" },
        { dimension: "Signaux d'intention", points: Math.round(score * 0.2), max: 20, reason: "Données de démonstration" },
        { dimension: "Historique & fidélité", points: Math.round(score * 0.15), max: 15, reason: "Données de démonstration" },
        { dimension: "Adéquation profil / séjour", points: score - Math.round(score * 0.25) * 2 - Math.round(score * 0.2) - Math.round(score * 0.15), max: 15, reason: "Données de démonstration" },
      ],
      summary,
      traveler_profile: { motivations: ["Découverte"], style: "Analyse de démonstration générée par le seed", budget_estimate: "Non estimé" },
      recommended_trips: [],
      next_actions: [{ action: "Lancer une vraie analyse avec Claude", channel: "CRM", deadline: dateOnly(1).toISOString().slice(0, 10), priority: "moyenne" }],
      risks: [],
      missing_info: [],
      call_pitch: [],
    };
    await db.aiAnalysis.create({
      data: {
        contactId: C(k), score, level: levelOf(score), summary, resultJson: result,
        model: "seed-demo", inputTokens: 0, outputTokens: 0, createdById: admin.id, createdAt,
      },
    });
    await db.contact.update({
      where: { id: C(k) },
      data: { lastScore: score, lastScoreLevel: levelOf(score), lastAnalyzedAt: createdAt },
    });
  }

  // Dernier contact (dénormalisé)
  await db.$executeRaw`
    UPDATE contacts c SET last_interaction_at = sub.max_at
    FROM (SELECT contact_id, MAX(occurred_at) AS max_at FROM interactions GROUP BY contact_id) sub
    WHERE sub.contact_id = c.id`;

  const counts = await Promise.all([db.user.count(), db.trip.count(), db.contact.count(), db.booking.count(), db.lead.count(), db.interaction.count()]);
  console.log(`Seed OK — ${counts[0]} utilisateurs, ${counts[1]} séjours, ${counts[2]} contacts, ${counts[3]} réservations, ${counts[4]} leads, ${counts[5]} interactions`);
  console.log(`Compte admin : ${adminEmail} (mot de passe : ADMIN_INITIAL_PASSWORD dans .env)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
