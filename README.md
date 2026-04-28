# Backend Global SOS Gestion - API REST

Backend API complet pour l'application Global SOS Gestion développé avec Express.js et TypeScript.

## 🚀 Installation et Configuration

### 1. Prérequis
- Node.js 18+
- PostgreSQL
- pnpm (recommandé) ou npm

### 2. Configuration de l'environnement
```bash
# Copier le fichier d'environnement
cp env.example .env

# Éditer les variables d'environnement
nano .env
```

Variables d'environnement requises :
```env
DATABASE_URL="postgresql://username:password@localhost:5432/globale_sos"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
```

### 3. Installation des dépendances
```bash
pnpm install
```

### 4. Configuration de la base de données
```bash
# Générer le client Prisma
pnpm db:generate

# Appliquer le schéma à la base de données
pnpm db:push

# Initialiser avec des données de test
pnpm db:seed
```

### 5. Lancement du serveur
```bash
# Mode développement
pnpm dev

# Mode production
pnpm build
pnpm start
```

## 📊 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Informations utilisateur
- `POST /api/auth/register` - Création d'utilisateur (Admin)

### Demandes
- `GET /api/demandes` - Liste des demandes
- `POST /api/demandes` - Créer une demande
- `GET /api/demandes/:id` - Détails d'une demande
- `PUT /api/demandes/:id` - Modifier une demande
- `DELETE /api/demandes/:id` - Supprimer une demande

### Finances
- `GET /api/finances/overview` - Vue d'ensemble financière
- `GET /api/finances/transactions` - Liste des transactions
- `POST /api/finances/transactions` - Créer une transaction

### Publications
- `GET /api/publications` - Liste des publications
- `POST /api/publications` - Créer une publication
- `GET /api/publications/:id` - Détails d'une publication
- `PUT /api/publications/:id` - Modifier une publication
- `DELETE /api/publications/:id` - Supprimer une publication

### Partenaires
- `GET /api/partenaires` - Liste des partenaires
- `POST /api/partenaires` - Créer un partenaire
- `GET /api/partenaires/:id` - Détails d'un partenaire
- `PUT /api/partenaires/:id` - Modifier un partenaire
- `DELETE /api/partenaires/:id` - Supprimer un partenaire

### Visites
- `GET /api/visites` - Liste des visites
- `POST /api/visites` - Créer une visite
- `GET /api/visites/:id` - Détails d'une visite
- `PUT /api/visites/:id` - Modifier une visite
- `DELETE /api/visites/:id` - Supprimer une visite

### Utilisateurs (Admin)
- `GET /api/users` - Liste des utilisateurs
- `POST /api/users` - Créer un utilisateur
- `GET /api/users/:id` - Détails d'un utilisateur
- `PUT /api/users/:id` - Modifier un utilisateur
- `DELETE /api/users/:id` - Supprimer un utilisateur

### Logs
- `GET /api/logs` - Logs système

### Commentaires
- `POST /api/comments` - Créer un commentaire

## 🔐 Système d'Authentification

### JWT Tokens
- Tokens signés avec secret configurable
- Expiration : 7 jours
- Cookies httpOnly pour la sécurité
- Refresh automatique

### Rôles et Permissions
- **ADMIN** : Accès complet + gestion utilisateurs
- **COORDINATOR** : Demandes, Documents, Publications, Partenaires, Visites
- **FINANCE** : Finances, Demandes, Documents
- **COMMUNICATION** : Publications, Partenaires, Documents
- **LOGISTICS** : Visites, Demandes, Documents

## 🛡️ Sécurité

### Middleware de Sécurité
- **Helmet** : Headers de sécurité
- **CORS** : Configuration cross-origin
- **Rate Limiting** : Limitation des requêtes
- **Compression** : Compression des réponses
- **Cookie Parser** : Gestion des cookies

### Validation des Données
- **Zod** : Validation des schémas
- **TypeScript** : Typage strict
- **Sanitisation** : Nettoyage des entrées

### Gestion d'Erreurs
- Gestionnaire d'erreurs global
- Logs détaillés
- Messages d'erreur sécurisés
- Codes de statut appropriés

## 📈 Monitoring et Logs

### Logs Système
- Toutes les actions sont tracées
- Logs avec IP, utilisateur, action
- Filtrage par module, action, utilisateur
- Pagination des résultats

### Health Check
- `GET /health` - État du serveur
- Informations de version
- Timestamp de réponse

## 🔧 Scripts Disponibles

```bash
# Développement
pnpm dev              # Mode développement avec watch
pnpm build            # Build de production
pnpm start            # Démarrer en production

# Base de données
pnpm db:generate      # Générer le client Prisma
pnpm db:push          # Appliquer le schéma
pnpm db:migrate       # Créer une migration
pnpm db:seed          # Initialiser avec des données
pnpm db:studio        # Interface graphique Prisma

# Tests et qualité
pnpm test             # Tests de validation
pnpm lint             # Vérifier le code
pnpm lint:fix         # Corriger automatiquement
```

## 📁 Structure du Projet

```
backend/
├── src/
│   ├── routes/           # Routes API
│   ├── middleware/       # Middlewares Express
│   ├── lib/             # Utilitaires et configuration
│   └── scripts/         # Scripts d'initialisation
├── prisma/              # Schéma de base de données
├── dist/                # Build de production
├── package.json         # Dépendances et scripts
├── tsconfig.json        # Configuration TypeScript
└── env.example          # Variables d'environnement
```

## 🚨 Notes Importantes

1. **Sécurité** : Changez le JWT_SECRET en production
2. **Base de données** : Configurez correctement la DATABASE_URL
3. **CORS** : Ajustez FRONTEND_URL selon votre environnement
4. **Logs** : Surveillez les logs système pour la sécurité
5. **Rate Limiting** : Ajustez selon vos besoins

## 🎯 Prochaines Étapes

Le backend est maintenant complètement fonctionnel avec :
- ✅ API REST complète
- ✅ Authentification sécurisée
- ✅ Système de permissions
- ✅ Validation des données
- ✅ Gestion d'erreurs
- ✅ Logs et monitoring
- ✅ Documentation complète

Prêt pour la production après configuration des variables d'environnement !
