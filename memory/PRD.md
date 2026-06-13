# TOP LOTTO - PRD

## Problem Statement
PWA de gestion de loterie haïtienne/brésilienne avec rôles, ventes POS, résultats, paiements de gagnants, rapports et impression de tickets. Bilingue FR/HT, multi-devises HTG/BRL.

## User Choices
- Auth: JWT simple (admin crée les machanns, pas de self-registration)
- Jeux: Bòlèt (2 chiffres) + Pick 3/4/5 (Straight/Box/Straight-Box/Combo)
- Impression: HTML imprimable (PWA) + format ESC/POS-compatible (preview noir/blanc thermique 58/80mm)
- Langues: FR + Kreyòl Ayisyen avec switch
- Devises: HTG + BRL avec taux configurable

## Architecture
- **Backend**: FastAPI single-file (`/app/backend/server.py`), MongoDB (motor), JWT (pyjwt) + bcrypt
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + recharts; AppContext (auth/i18n/currency)
- **Style**: Dark theme, Gold (#FACC15) primary, IBM Plex Mono pour nombres, Chivo pour titres

## Implementations V4 (Feb 2026)
- [x] **Logo TOP LOTTO** intégré dans `/app/frontend/src/assets/logo.jpeg` + composant `<Logo>` rond avec ring doré, utilisé dans sidebar, drawer mobile, login, et ticket print
- [x] **Ticket redesign** style colorful (sections BÒLÈT rouge / PICK 3 vert / PICK 4 bleu / PICK 5 violet / MARYAJ orange / GRATIS rose) avec header bleu marine, logo rond doré, total banner, barcode + footer www.toplotto.com — fidèle à l'exemple fourni
- [x] **Lottery Results Feed API** (lotteryresultsfeed.com) intégré avec token dans `.env`, endpoint POST `/api/results/import?date=YYYY-MM-DD` qui récupère Pick3+Pick4 et dérive bòlèt[0] automatiquement
- [x] **Horaires loteries** configurables (heure locale + timezone IANA America/New_York ou America/Chicago + close_offset_minutes)
- [x] **Validation timezone-aware**: ventes bloquées si > heure tirage - offset_min (utilise zoneinfo)
- [x] **Conversion US ↔ Brésil** dans Sales page: countdown "Prochain tirage 21:45 New York • 22h 56m"
- [x] **Commission marchand** configurable au formulaire utilisateur (UserCreate.commission_percent) + endpoint `/api/machann/commission` qui retourne `{sales, commission_percent, commission_amount}`
- [x] **Mise à jour auto statut tickets** sur POST /api/results: items[].winning, win_position, win_key, payout, ticket.payout_amount + has_result persistés en DB → la liste tickets reflète immédiatement
- [x] **PDF download** via reportlab (`/api/tickets/{n}/pdf`) avec bouton "PDF" dans le modal ticket
- [x] **WhatsApp share** via Web Share API (mobile) ou fallback wa.me + auto-download PDF
- [x] **Onglet Loteries** dans Paramètres avec édition inline + bouton "Importer résultats API"
- [x] **Tests**: V4 backend 9/9, V3 backend 36/37, frontend OK

## Implementations V3 (Feb 2026)
- [x] **BRL UNIQUEMENT** — HTG/Gourdes complètement supprimé (switch devise enlevé du header)
- [x] **Paires automatiques = 10 doubles 00,11,22,33,44,55,66,77,88,99** en un clic + prix commun, éditable par item après
- [x] **Bulk paste** séparé pour autres numéros multiples
- [x] **Super admin extended powers**: éditer items + nom client d'un ticket, annuler/supprimer même un ticket payé (reverse paiement), hard-delete utilisateur
- [x] **Notifications in-app** — cloche dans header avec badge unread, dropdown liste + mark-read
- [x] **Triggers auto**: "Rezilta yo soti" pour machanns sur POST /api/results ; "Tikè genyen pou peyman" pour admin+super_admin si tickets gagnants pour ce tirage
- [x] **PWA**: manifest.json + sw.js + icône SVG + meta tags installable + SW registration en production
- [x] **Offline ticket queue** localStorage + sync auto online + indicator EN LIGNE/HORS LIGNE + compteur tickets en attente cliquable pour sync manuel
- [x] **ESC/POS infrastructure**: backend endpoint /api/tickets/{n}/escpos (binaire 58/80mm) + /api/print/network (TCP socket)
- [x] **Impression multi-types**: navigateur / Bluetooth (Web Bluetooth GATT) / USB (Web Serial) / Réseau (TCP) configurable dans Paramètres → onglet Imprimante
- [x] **Tests**: Backend V2+V3 = 37 tests, 36/37 pass (97%), 1 minor cancelled-ticket fix appliqué
- [x] Auth JWT + 6 rôles
- [x] 8 loteries (FL/GA/NY/TX × Midi/Soir) avec state+session
- [x] **Auto-détection du jeu par nombre de chiffres** (2=Bòlèt, 3=Pick 3, 4=Pick 4, 5=Pick 5) — plus de sélecteur play_type
- [x] **Mariage Boul**: 2 numéros 2-chiffres en dialog, gagne si les 2 sortent (payout 500x configurable)
- [x] **Paires automatiques**: bulk add — plusieurs numéros séparés par espace/virgule + un seul prix
- [x] **Édition individuelle des prix** dans le panier après ajout en lot
- [x] **Taux Bòlèt configurables**: premye/dezyèm/twazyèm (default 50/20/10) + mariage (500x)
- [x] Pick 3/4/5 payouts configurables (default 500/5000/50000x)
- [x] **Résultats par date — 8 tirages en grille** (FL/GA/NY/TX × Midi/Soir) avec Pick 3, Pick 4, 3 boul bòlèt par tirage
- [x] **Identification des boules gagnantes** sur ticket (★ 1ye/2yèm/3yèm pour bòlèt, ★ Sòti pour mariage)
- [x] **Affichage des numéros tirés** dans la page Vérification (Bòlèt boul + Pick 3 + Pick 4 visibles)
- [x] **Conversion devise HTG↔BRL réelle** via formatMoney avec taux configurable
- [x] **Responsive mobile** avec hamburger menu, header compact, formulaires empilables
- [x] **Tout en français/kreyòl** — zéro anglais (TIKÈ, DAT, LOTRI, MACHANN, KLIYAN, JWÈT, REZILTA, GENYEN, PEYE...)
- [x] Migration auto des loteries (state+session) au démarrage

## Backlog (P1/P2)
- P1: 2FA TOTP
- P1: ESC/POS direct (agent local ou serial WebUSB)
- P1: Mode offline avec service worker + sync auto
- P1: Limites par numéro/jeu/lottery/machann (UI complète + check côté backend)
- P1: Comptabilité (dépôts/retraits, balance détaillée par machann)
- P2: Sauvegardes auto + restauration UI
- P2: API import résultats (NY/GA/TX/FL Pick 3/4/5 publics)
- P2: Notifications SMS/WhatsApp (Twilio)
- P2: PDF export rapports (reportlab)
- P2: QR code scanné caméra mobile pour vérif rapide

## Test Coverage
- Backend: 27/27 pytest (auth, users, agencies, tickets, results, payouts, dashboard, reports, settings, auth-z)
- Frontend: playwright passes login, dashboard, sales-end-to-end, verify, results, admin, lang/currency switches
- Test credentials: `/app/memory/test_credentials.md`
