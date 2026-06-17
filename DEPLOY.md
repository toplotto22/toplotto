# TOP LOTTO — Déploiement Render + MongoDB Atlas

## 1. Préparer MongoDB Atlas
1. Créer un cluster gratuit sur https://www.mongodb.com/cloud/atlas
2. Database Access → ajouter un user avec mot de passe
3. Network Access → autoriser 0.0.0.0/0 (ou les IPs Render)
4. Connect → "Connect your application" → copier l'URI : `mongodb+srv://USER:PASS@cluster.mongodb.net/?retryWrites=true&w=majority`

## 2. Variables d'environnement Render

### Backend (top-lotto-backend)
| Variable | Valeur |
|----------|--------|
| `MONGO_URL` | `mongodb+srv://...` (depuis Atlas) |
| `DB_NAME` | `toplotto` |
| `CORS_ORIGINS` | `https://top-lotto-frontend.onrender.com` |
| `JWT_SECRET` | auto-généré par Render |
| `LOTTERY_API_TOKEN` | `64578\|57xZs8Z83lPvtHoqej1JY0Lm8g9q2r2AGM2zldxT8b624bb5` |
| `ADMIN_INITIAL_EMAIL` | votre email super admin |
| `ADMIN_INITIAL_PASSWORD` | un mot de passe fort |

### Frontend (top-lotto-frontend)
| Variable | Valeur |
|----------|--------|
| `REACT_APP_BACKEND_URL` | `https://top-lotto-backend.onrender.com` |

## 3. Déploiement
```bash
git remote add render https://github.com/VOTRE_USER/top-lotto.git
git push origin main
```
Sur Render: Blueprint → connecter le repo → le `render.yaml` est détecté automatiquement.

## 4. Après le premier déploiement
- Le super admin est créé automatiquement avec les valeurs `ADMIN_INITIAL_*`
- L'auto-import de l'API tourne en arrière-plan toutes les 5 minutes (fuseau Haïti)
- Les loteries sont seedées avec timezones US (NY=ET, Texas=CT) et horaires officiels

## 5. Sécurité Production
- Changez `JWT_SECRET` (Render le génère automatiquement)
- Changez `ADMIN_INITIAL_PASSWORD` à votre première connexion via Paramètres → Utilisateurs → Éditer
- Pour aller plus loin: MongoDB Atlas avec backup automatique activé
