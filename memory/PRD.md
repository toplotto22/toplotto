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

## Implementations V10 (June 2026) — Dashboard Profit + Page Paiements refonte
- [x] **Carte HERO "Profit Net Pwopriyetè Jodi a"** sur Dashboard (super_admin/admin/directeur uniquement):
  - Calcul: `Ventes − Gains à payer − Gains payés − Commissions machanns`
  - Affichage en GROS (clamp 2.5rem→5rem), vert si positif / rouge si négatif
  - Breakdown 4 colonnes: Ventes / Gains à payer / Gains payés / Commissions
  - Indicateur "X tikè à payer" si gains non payés
- [x] **Endpoint backend `/api/dashboard/stats` enrichi**:
  - Nouveaux champs: `payouts_owed`, `commission_total`, `net_profit`, `tickets_unpaid_winning`, `machann_breakdown`
  - Aggregation par machann avec commission_percent
- [x] **Page Paiements entièrement refondue** (comme un comptable pro):
  - Filtre période: Jodi a / Semèn / Mwa a / Tout
  - 4 cartes de stats: À PAYER, PAYÉS, TOTAL GAGNANTS, VENTES
  - 3 onglets: À payer / Payés / Historique
  - Cards individuels par ticket avec numéros gagnants surlignés + montant en gros
  - Bouton "💲 Marquer Payé" prominent
  - Recherche par n° de ticket
- [x] **Endpoint `/api/payments?period=today|week|month`** avec filtre côté serveur

## Implementations V9 (June 2026) — Mobile UX + winners + PWA auto-update
- [x] **PWA auto-update aggressive**: SW network-first sur HTML+JS+CSS bundles. Auto-check toutes les 5 min. Quand une nouvelle version est détectée, l'app se recharge automatiquement (les utilisateurs installés reçoivent les MAJ sans intervention)
- [x] **Indicateur "En ligne" maintenant visible sur mobile** (avant `hidden sm:flex` masquait sur petits écrans)
- [x] **Highlight visuel des numéros gagnants** dans ticket UI: 
  - Numéro gagnant en vert avec 🏆
  - Badge "1YE/2YEM/3YEM" ou "GENYEN" 
  - Montant gagné affiché en gros vert "+R$ X.XX" à côté du numéro
  - Mise initial barrée
- [x] **Bouton "Marquer Payé" 💲** sur chaque ticket gagnant (super_admin/admin)
- [x] **Bouton raccourci "🏆 Gagnants"** filtre instantanément tickets gagnants
- [x] **Bouton "🔄 Recalculer"** force le recalcul des statuts gagnant/perdu pour aujourd'hui (debug bug)
- [x] **Endpoint backend `POST /api/tickets/recalculate?draw_date=YYYY-MM-DD`**: retraite tous les tickets, retourne `{recalculated, fixed_to_won, fixed_to_lost}`
- [x] **Tests V9**: regression V8 6/6 + recalculate endpoint testé manuellement (17 tickets traités OK)

## Implementations V8 (June 2026) — Multi-lottery, Replay, PDF lang, time fix
- [x] **Bug timezone PDF corrigé**: les dates/heures sur les PDF utilisent maintenant `format_haiti_dt()` (conversion UTC→Haiti TZ), alignées avec l'affichage app
- [x] **Logo PDF parfaitement rond**: génération PIL avec masque circulaire alpha (cache `logo_circle.png`)
- [x] **Multi-loteries sur un seul ticket**: 
  - Backend: champ `lottery_ids: List[str]` (compatible legacy `lottery_id`)
  - Total = (somme items) × N loteries
  - Endpoint `/results` recalcule payout en agrégeant les gains sur toutes les loteries où le ticket joue
  - Statut "active" tant que toutes les loteries n'ont pas leurs résultats
  - Frontend Sales: liste de cases à cocher (au lieu d'un dropdown single-select)
  - Page Tickets: affichage "★ Multi (N)" pour les tickets multi-loteries
- [x] **Bouton "Rejouer" / Duplicate ticket**:
  - Backend: `POST /api/tickets/{n}/duplicate` recrée un ticket identique avec date du jour
  - Frontend: icône RotateCcw verte sur chaque ticket (desktop + mobile)
- [x] **Langue du ticket imprimé suit l'app**: 
  - PDF accepte `?lang=ht|fr`
  - Frontend passe automatiquement la langue courante (`language` de `useApp`)
  - Labels traduits: AJANS/AGENCE, TIKÈ/TICKET, VANDÈ/VENDEUR, DAT/DATE, LÈ/HEURE, LOTRI/LOTERIE, TIRAJ/TIRAGE, TOTAL JENERAL/TOTAL GÉNÉRAL, GENYEN/GAGNANT, etc.
- [x] **Tests V8**: 6/6 pytest pass (multi-lottery, duplicate, PDF lang)

## Implementations V7 (June 2026) — QR, PDF Reports, Web Push
- [x] **QR Code sur tickets PDF**: chaque ticket affiche un QR code (URL vers /verify/{num}). Eskane et verifye instantanément
- [x] **Page publique de vérification `/verify/:num`** (sans login): affiche logo, numéro, statut (RAN TIRAJ / GENYEN / PA GENYEN / DEJA PEYE), détails items colorés, résultat officiel si dispo
- [x] **Scanner QR caméra** sur page Vérifier (auth): bouton "Eskane QR" → ouvre caméra via html5-qrcode → décode → vérifie automatiquement
- [x] **Export PDF Rapports**: nouveau bouton rouge "PDF" sur page Reports. Génère PDF stylé avec en-tête navy/gold + tableau + ligne TOTAL surlignée
- [x] **Web Push notifications (VAPID)**:
  - Endpoint `GET /api/push/vapid-public-key` retourne clé publique
  - Endpoint `POST /api/push/subscribe` enregistre subscription
  - Endpoint `POST /api/push/test` envoie notification test
  - Trigger automatique sur publication résultats: "Rezilta yo soti! 🎰 Florida Midi — 2026-06-18"
  - Service Worker handler dans sw.js (push + notificationclick)
  - Bouton bell/bell-off dans header Layout pour activer/désactiver
- [x] **Bug VAPID corrigé**: clé privée stockée en base64url DER (PKCS8) au lieu de PEM (pywebpush incompatible avec PEM)
- [x] **PWA icons updated**: 9 tailles PNG du logo TOP LOTTO (16→512), favicon.ico, apple-touch-icon, maskable variant
- [x] **Tests V7**: 17/17 pytest pass + frontend public verify validé visuellement

## Implementations V6 (June 2026) — PDF coloré + Logo PWA
- [x] **PDF ticket entièrement redessiné**: header navy + logo rond doré, sections colorées par jeu (BÒLÈT rouge, PICK 3 vert, PICK 4 bleu, PICK 5 violet, MARYAJ orange, MARYAJ GRATIS rose), banner TOTAL navy/gold, banner GENYEN vert, zone REZILTA jaune, bottom bar navy "★ www.toplotto.com ★"
- [x] **Logo TOP LOTTO comme icône d'application**: 9 tailles PNG (16/32/48/64/128/192/256/384/512), favicon.ico, apple-touch-icon (180×180), icon-maskable (Android adaptive), manifest.json mis à jour, SW cache bumpé v1→v2
- [x] **Bug Render `DuplicateKeyError` corrigé**: super_admin seed maintenant fully idempotent (delete stale + upsert by email)

## Implementations V5 (June 2026) — Production deploy + UX features
- [x] **Render deployment**: Frontend Live ✅ + Backend Live ✅ (Python 3.12.7 via PYTHON_VERSION env var)
- [x] **Super admin credentials updated**: admin@toplotto.com / Admin@1000 (force-update idempotent on every startup)
- [x] **Sales page crash fixed** — `settings is not defined` (destructure ajouté ligne 24)
- [x] **Haiti timezone (America/Port-au-Prince)** appliqué globalement:
  - Backend: `now_haiti()` helper utilisé pour ticket_number prefix, dashboard "today", top-machann month, trend 7 jours
  - Frontend: `lib/time.js` helper `todayHaiti()` utilisé dans Sales/Results/Reports/Admin
- [x] **Ticket status auto-update** sur POST /api/results et import API: status devient `won` si payout > 0, sinon `lost` (avant restait "active")
- [x] **Tickets page refonte complète**:
  - Filtres: recherche, statut (Tous/En attente/Gagné/Perdu/Payé/Annulé), loterie, tirage (midi/soir), date
  - Mobile responsive: cards affichent Loterie / Tirage / Machann clairement
  - Bulk delete (super_admin): "Suppr. par jour" + "Suppr. TOUT" avec confirmation AlertDialog
  - Endpoints backend: `DELETE /api/tickets/bulk/by-date?draw_date=X` et `DELETE /api/tickets/bulk/all`
- [x] **Reports** — ligne TOTAL (bordure jaune) en bas du tableau avec sommes tickets/ventes/gagnants/paiements/profit
- [x] **Boules bòlèt bloquées (super_admin)**:
  - Nouvel onglet "Boules bloquées" dans Paramètres
  - Validation backend: rejette POST /api/tickets si boul bolet ou partie de mariage est bloquée → 400 "Boul XX bloqué"
  - UI: input multi-numéros + grille cliquable pour débloquer
- [x] **Import API automatique** (lotteryresultsfeed.com):
  - Nouvel onglet "API Auto" dans Paramètres: token, URL, enabled, interval
  - Background scheduler `asyncio.create_task(auto_import_loop())` au démarrage
  - Met à jour automatiquement résultats + statuts tickets toutes les X minutes (configurable, défaut 30)
- [x] **Manifest PWA**: ajout `<meta name="mobile-web-app-capable">` (warning obsolète résolu)
- [x] **Tests V5**: 21/21 pytest pass, frontend UI verifié à 100%

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
