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

## Implementations (Feb 2026 - V1)
- [x] Auth JWT (login, /me, token expire 12h)
- [x] Rôles: super_admin, directeur, superviseur, admin, sous_admin, machann
- [x] Seed automatique: 8 loteries + Super Admin (admin@toplotto.ht / Admin123!) + Agence Principale
- [x] CRUD Utilisateurs (admin/super_admin)
- [x] CRUD Agences
- [x] POS Vente (lottery + draw_date + game + play_type + cart + Enter shortcuts + auto-print)
- [x] Liste/Recherche Tickets
- [x] Vérification ticket (par numéro) + Paiement gagnants
- [x] Saisie résultats (3 numéros par jeu par tirage)
- [x] Calcul automatique gains (straight, box, straight_box, combo + position multiplier 1.0/0.5/0.25)
- [x] Dashboard: ventes, paiements, profit, tickets vendus/gagnants, balance, trend 7j, by_lottery pie, recent
- [x] Paiements (historique)
- [x] Rapports (group_by day/lottery/machann/agency) + export CSV
- [x] Paramètres globaux (business info, taux change, payouts configurables par jeu/play_type)
- [x] Audit logs sur actions clés
- [x] i18n FR/HT switch
- [x] Devise switch HTG/BRL
- [x] Impression ticket (modal blanc/noir style thermique avec barcode visuel + footer personnalisé)

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
