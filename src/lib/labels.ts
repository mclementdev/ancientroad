import type {
  AiLevel,
  BookingStatus,
  ContactStatus,
  DepartureStatus,
  Direction,
  Gender,
  InteractionType,
  InterestLevel,
  InterestSource,
  LeadChannel,
  LeadStatus,
  LicenseType,
  RelationType,
  RiderRole,
  RidingLevel,
  Role,
  TaskType,
  TripFormat,
} from "@/generated/prisma/enums";

export const roleLabels: Record<Role, string> = {
  conseiller: "Conseiller",
  manager: "Manager",
  admin: "Admin",
};

export const genderLabels: Record<Gender, string> = {
  femme: "Femme",
  homme: "Homme",
  non_precise: "Non précisé",
};

export const contactStatusLabels: Record<ContactStatus, string> = {
  prospect: "Prospect",
  client: "Client",
  fidele: "Fidèle",
  inactif: "Inactif",
};

export const riderRoleLabels: Record<RiderRole, string> = {
  pilote: "Pilote",
  passager: "Passager",
};

export const licenseTypeLabels: Record<LicenseType, string> = {
  A: "Permis A",
  A2: "Permis A2",
  A1: "Permis A1",
  B_125: "Permis B + 125",
  aucun: "Aucun",
};

export const ridingLevelLabels: Record<RidingLevel, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  confirme: "Confirmé",
  expert: "Expert",
};

export const leadChannelLabels: Record<LeadChannel, string> = {
  email_form: "Formulaire email",
  callback: "Demande de rappel",
  inbound_call: "Appel entrant",
};

export const leadStatusLabels: Record<LeadStatus, string> = {
  nouveau: "Nouveau",
  qualification: "Qualification",
  devis_envoye: "Devis envoyé",
  gagne: "Gagné",
  perdu: "Perdu",
  injoignable: "Injoignable",
};

export const tripFormatLabels: Record<TripFormat, string> = {
  guide: "Guidé",
  liberte: "Liberté",
  sur_mesure: "Sur-mesure",
};

export const departureStatusLabels: Record<DepartureStatus, string> = {
  ouvert: "Ouvert",
  garanti: "Garanti",
  complet: "Complet",
  annule: "Annulé",
  termine: "Terminé",
};

export const bookingStatusLabels: Record<BookingStatus, string> = {
  option: "Option",
  confirme: "Confirmé",
  solde: "Soldé",
  annule: "Annulé",
};

export const relationLabels: Record<RelationType, string> = {
  conjoint: "Conjoint·e",
  enfant: "Enfant",
  parent: "Parent",
  frere_soeur: "Frère / sœur",
  ami: "Ami·e",
  collegue: "Collègue",
  autre: "Autre",
};

export const interestLevelLabels: Record<InterestLevel, string> = {
  faible: "Faible",
  moyen: "Moyen",
  fort: "Fort",
};

export const interestSourceLabels: Record<InterestSource, string> = {
  formulaire: "Formulaire",
  appel: "Appel",
  email: "Email",
  salon: "Salon",
  newsletter: "Newsletter",
  conseiller: "Conseiller",
};

export const interactionTypeLabels: Record<InteractionType, string> = {
  call_in: "Appel entrant",
  call_out: "Appel sortant",
  email_in: "Email reçu",
  email_out: "Email envoyé",
  newsletter_sent: "Newsletter envoyée",
  newsletter_open: "Newsletter ouverte",
  newsletter_click: "Clic newsletter",
  callback: "Demande de rappel",
  meeting: "Rendez-vous",
  fair: "Salon",
};

export const directionLabels: Record<Direction, string> = {
  entrant: "Entrant",
  sortant: "Sortant",
};

export const taskTypeLabels: Record<TaskType, string> = {
  rappel: "Rappel",
  relance: "Relance",
  devis: "Devis",
  autre: "Autre",
};

export const aiLevelLabels: Record<AiLevel, string> = {
  froid: "Froid",
  tiede: "Tiède",
  chaud: "Chaud",
  pret_a_reserver: "Prêt à réserver",
};

/** Paires [valeur, libellé] pour alimenter les <Select>. */
export function options<T extends string>(labels: Record<T, string>): [T, string][] {
  return Object.entries(labels) as [T, string][];
}
