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

## Implementations (Feb 2026 - V2 PRODUCTION)
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
