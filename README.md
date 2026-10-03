# Ancient Roads — CRM

CRM d'un tour-opérateur de voyages à moto en petits groupes (formats guidé, liberté, sur-mesure ; pilotes et passagers). Interface en français.

- **Tableau de bord** : rappels du jour triés par créneau, tâches en retard, leads « nouveau » de plus de 24 h, top 10 par score IA, prochains départs.
- **Contacts** : recherche multi-mots, filtres (statut, destination d'intérêt, score, dernier contact, conseiller), tri, pagination.
- **Fiche client** : identité, profil rider, séjours achetés (CA total, panier moyen), séjours d'intérêt, compagnons de voyage, timeline filtrable, notes, analyse IA, consentements. Tous les blocs sont éditables.
- **Leads** : file unique, affectation, statuts, conversion en contact avec dédoublonnage (email puis téléphone).
- **Catalogue** : séjours et départs (CRUD, réservé aux managers).
- **Réservations** : création et modification avec participants pilotes / passagers, gestion automatique des places.
- **Nouvel appel** : saisie rapide depuis n'importe quel écran (bouton en haut à droite ou `Alt + N`).
- **Analyse IA** : score de 0 à 100 et plan d'action par Claude, via `POST /api/contacts/:id/analyze`.
- **Webhook** `POST /api/leads` pour les formulaires du site.

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 + shadcn/ui · PostgreSQL 16 + Prisma 7 (migrations versionnées) · Auth.js v5 (email + mot de passe, sessions JWT) · SDK Anthropic TypeScript + Zod · Vitest.

## Installation

Prérequis : Node.js 20.9 ou plus récent, Docker (pour PostgreSQL).

```bash
npm install
```

```bash
cp .env.example .env
```

Renseignez ensuite `.env` (voir le tableau ci-dessous). Pour générer les secrets :

```bash
openssl rand -base64 32
```

Démarrez la base, appliquez les migrations et chargez les données de démonstration :

```bash
docker compose up -d
```

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

Lancez l'application sur http://localhost:3000 :

```bash
npm run dev
```

### Comptes

Le seed crée le compte **administrateur** `ADMIN_EMAIL` avec le mot de passe `ADMIN_INITIAL_PASSWORD`, ainsi que trois conseillers de démonstration (`claire.dubois@ancientroads.test`, `julien.moreau@ancientroads.test`, `sofia.benali@ancientroads.test`) qui partagent ce même mot de passe. **Changez-le** à la première connexion : menu utilisateur → *Mon compte*.

Pour ajouter quelqu'un : *Utilisateurs* → *Inviter une personne*. Un lien valable 7 jours est généré, à envoyer soi-même (l'application n'envoie pas d'email). La personne choisit son nom et son mot de passe en ouvrant le lien.

| Rôle | Droits |
|---|---|
| Conseiller | Lit tout ; modifie ses contacts (et ceux sans conseiller) ; traite ses leads et peut prendre un lead libre |
| Manager | Tout, plus l'affectation des leads et des contacts, et le catalogue |
| Admin | Comme manager, plus la gestion des utilisateurs et des invitations |

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL. La valeur d'exemple correspond au `docker-compose.yml` (port 5433). |
| `AUTH_SECRET` | Secret de signature des sessions Auth.js (`openssl rand -base64 32`). |
| `APP_URL` | URL publique de l'application, utilisée pour construire les liens d'invitation. |
| `ADMIN_EMAIL` | Email du compte administrateur créé par le seed. |
| `ADMIN_INITIAL_PASSWORD` | Mot de passe initial de ce compte (et des conseillers de démo). |
| `ANTHROPIC_API_KEY` | Clé API Anthropic pour l'analyse IA. Sans clé, le bouton « Analyser avec Claude » affiche une erreur explicite. |
| `ANTHROPIC_MODEL` | Modèle utilisé pour l'analyse, `claude-opus-5-5` par défaut. |
| `LEADS_WEBHOOK_SECRET` | Secret partagé avec les formulaires du site, envoyé dans le header `X-Webhook-Secret`. |

## Déploiement sur Vercel (avec Neon)

Fichiers concernés :
- `vercel.json` : le build applique les migrations (`prisma migrate deploy`) avant `next build` ; les fonctions tournent à Francfort (`fra1`).
- `prisma.config.ts` : les migrations et le seed utilisent la connexion directe `DATABASE_URL_UNPOOLED`.

Étapes :
1. Poussez le dépôt sur GitHub, puis importez-le dans Vercel (*Add New → Project*).
2. Dans le projet Vercel, ouvrez *Storage → Create Database → Neon*. Choisissez la région **AWS eu-central-1 (Frankfurt)** pour être au plus près des fonctions. L'intégration ajoute `DATABASE_URL` et `DATABASE_URL_UNPOOLED`.
3. Dans *Settings → Environment Variables*, ajoutez les autres variables du tableau ci-dessus. Utilisez des secrets **différents** de ceux du développement local, et mettez dans `APP_URL` l'URL réelle du projet.
4. Redéployez. Les migrations s'appliquent pendant le build.
5. Chargez les données une seule fois, depuis votre poste. Le seed efface les données existantes, d'où la confirmation `SEED_ALLOW_REMOTE=oui` exigée sur une base distante :

```bash
SEED_ALLOW_REMOTE=oui DATABASE_URL_UNPOOLED="<URL directe Neon>" ADMIN_INITIAL_PASSWORD="<mot de passe prod>" npm run db:seed
```

L'analyse IA déclare `maxDuration = 90` secondes, ce qui laisse passer l'appel à Claude, limité à 60 s.

## Brancher les formulaires du site sur `/api/leads`

**Le secret ne doit jamais apparaître dans le navigateur.** L'appel doit venir d'un serveur : le backend du site, une fonction serverless, ou le webhook de votre outil de formulaires (Webflow, Typeform, Tally…). Ne mettez pas le secret dans du JavaScript côté client.

### Requête

`POST https://<votre-crm>/api/leads`

- Header `X-Webhook-Secret: <LEADS_WEBHOOK_SECRET>`
- Corps en JSON (`Content-Type: application/json`) ou en formulaire (`application/x-www-form-urlencoded` / `multipart/form-data`)

| Champ | Obligatoire | Description |
|---|---|---|
| `channel` | oui | `email_form` (demande par email) ou `callback` (demande de rappel) |
| `first_name`, `last_name` | non | Prénom, nom |
| `email` | email **ou** téléphone | Normalisé (minuscules) |
| `phone` | requis pour `callback` | Tout format (`06 12 34 56 78`, `+33…`), converti en E.164 |
| `callback_slot` | non | Libellé du créneau choisi, ex. `12h-14h` |
| `callback_at` | non | Date/heure ISO 8601 du rappel, ex. `2026-10-05T12:00:00+02:00` (par défaut : maintenant) |
| `trip_id` | non | Identifiant du séjour dans le CRM (visible dans l'URL `/catalogue/<id>`) ; ignoré s'il est inconnu |
| `message` | non | Message libre |
| `utm_source`, `utm_campaign` | non | Suivi des campagnes |

Les noms en camelCase (`firstName`, `callbackAt`…) sont aussi acceptés.

### Ce que fait le CRM

1. Il crée un lead au statut « nouveau » dans la file *Leads*.
2. Il cherche un contact existant par **email**, puis par **téléphone** (mobile ou fixe). S'il en trouve un, il rattache le lead au contact, l'affecte au conseiller du contact, ajoute une interaction à sa timeline et enregistre le séjour demandé comme intérêt.
3. Pour une demande de rappel, il crée une **tâche « rappel » à l'heure demandée**. Elle apparaît dans les rappels du jour du tableau de bord.

### Réponses

| Code | Signification |
|---|---|
| `201` | `{ "ok": true, "lead_id": "…", "contact_id": "…" \| null, "matched_on": "email" \| "phone" \| null }` |
| `401` | Secret absent ou incorrect |
| `422` | Données invalides : `{ "error": "Données invalides", "details": { "phone": ["…"] } }` |
| `400` / `500` | Corps illisible / erreur serveur |

### Exemples

Demande de rappel :

```bash
curl -X POST http://localhost:3000/api/leads -H "Content-Type: application/json" -H "X-Webhook-Secret: $LEADS_WEBHOOK_SECRET" -d '{"channel":"callback","first_name":"Anne","last_name":"Leroy","phone":"06 12 34 56 78","callback_slot":"12h-14h","callback_at":"2026-10-05T12:00:00+02:00","message":"Infos Mongolie"}'
```

Depuis le backend d'un site en Node.js (route qui reçoit le formulaire) :

```ts
await fetch(`${process.env.CRM_URL}/api/leads`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Webhook-Secret": process.env.LEADS_WEBHOOK_SECRET! },
  body: JSON.stringify({
    channel: "email_form",
    first_name: form.firstName,
    last_name: form.lastName,
    email: form.email,
    message: form.message,
    trip_id: form.tripId,
    utm_source: form.utm_source,
    utm_campaign: form.utm_campaign,
  }),
});
```

## Analyse IA

Le bouton « Analyser avec Claude » de la fiche client envoie à Claude :

- un **dossier JSON** du contact : identité sans adresse postale, téléphones ni email (seule leur présence est indiquée), consentements, profil rider, CA, séjours achetés, intérêts, compagnons (prénom, âge, lien), leads récents, tâches ouvertes, 50 dernières interactions, notes libres et date du jour ;
- le **catalogue des séjours actifs** avec les départs à venir, placé dans un bloc système mis en cache.

Claude renvoie son analyse via l'outil `save_analysis`, défini avec un schéma strict. Le prompt système, avec la grille de score et les consignes, se trouve dans [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts). La réponse est ensuite validée avec Zod ([src/lib/ai/schema.ts](src/lib/ai/schema.ts)) :

- le niveau est recalé sur la grille si besoin (0-24 Froid, 25-49 Tiède, 50-74 Chaud, 75-100 Prêt à réserver) ;
- les séjours hors catalogue sont écartés ;
- l'analyse est enregistrée dans `ai_analyses` avec les tokens consommés, et le score est reporté sur le contact.

Limites et erreurs :

- une analyse par contact toutes les 5 minutes (HTTP 429 sinon) ;
- délai maximal de 60 secondes ;
- en cas d'échec (délai dépassé, API indisponible, sortie invalide), la fiche affiche l'erreur et un bouton « Réessayer ».

À propos de `tool_choice` : les modèles récents (Claude Opus 5.5, Sonnet 5.5, Fable 5.1) **refusent le `tool_choice` forcé**. Sur ces modèles, le code envoie `tool_choice: auto`, l'outil en mode `strict` et une consigne explicite. Il vérifie ensuite que l'outil a bien été appelé, avec une nouvelle tentative si ce n'est pas le cas. Sur les modèles qui l'acceptent (Opus 4.8, Haiku 4.5…), l'outil est forcé. Les modèles 5.x reçoivent aussi le paramètre `fallbacks: "default"`, qui relance la requête sur un autre modèle si Claude refuse pour raison de sécurité. Le choix se fait dans `modelCapabilities()` ([src/lib/ai/analyze.ts](src/lib/ai/analyze.ts)).

Le seed contient des analyses marquées « Données de démo », qui alimentent le top 10 du tableau de bord. Elles ne comptent pas dans la limite des 5 minutes.

## Règles de calcul

- **CA total** : somme des réservations **payées par le contact** au statut *confirmé* ou *soldé* (les options et annulations sont exclues).
- **Panier moyen** : CA total / nombre de ces réservations.
- **Nombre de voyages** : réservations non annulées où le contact est participant.
- **Dernier voyage** : départ le plus récent déjà commencé.
- **Dernier contact** : date de la dernière interaction.
- **Compagnons de voyage** : autres participants des mêmes réservations (non annulées). Les proches liés sans voyage commun sont aussi listés. Le lien (conjoint, enfant…) se modifie depuis le bloc.
- **Places** : `seats_left` est recalculé à chaque réservation. Un départ passe en *complet* à 0 place, et revient à *ouvert* si des places se libèrent.
- **Tarif passager** : proposé par défaut à 65 % du prix pilote, modifiable ligne par ligne.
- Un prospect ou inactif qui réserve passe automatiquement au statut *client*.
- Les « jours » (rappels du jour, etc.) sont calculés à l'heure de Paris, quel que soit le fuseau du serveur.

## Commandes utiles

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm test` | Tests Vitest (dédoublonnage, panier moyen, compagnons, validation de l'analyse IA avec Claude mocké) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run db:migrate` | Nouvelle migration après modification de `prisma/schema.prisma` |
| `npm run db:seed` | Recharge les données de démo (efface contacts, leads, réservations… mais conserve les utilisateurs) |
| `npm run db:reset` | Réinitialise complètement la base (supprime tout, y compris les utilisateurs), puis relancer `npm run db:seed` |

## Arborescence

```
prisma/              schéma, migrations, seed
src/app/(auth)/      connexion, acceptation d'invitation
src/app/(crm)/       écrans (tableau de bord, contacts, leads, catalogue, réservations, admin, compte)
src/app/api/         webhook leads, analyse IA, Auth.js
src/components/      UI (shadcn/ui), blocs de la fiche, formulaires
src/server/actions/  Server Actions (écritures, avec contrôle des droits)
src/server/queries/  lectures
src/lib/domain/      logique métier testée (stats, compagnons, dédoublonnage, intégration des leads)
src/lib/ai/          prompt, dossier, schéma, appel à Claude
tests/               Vitest
```

## Limites connues du MVP

- Pas d'envoi d'email : les liens d'invitation sont à copier et à transmettre soi-même.
- Pas de réinitialisation de mot de passe oublié : chacun peut changer le sien depuis *Mon compte*, mais un mot de passe perdu nécessite une intervention en base.
- Pas de fusion manuelle de doublons existants (le dédoublonnage se fait à l'entrée des leads et à la création des contacts).
