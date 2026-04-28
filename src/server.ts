import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

// Import des routes
import authRoutes from './routes/auth'
import demandesRoutes from './routes/demandes'
import financesRoutes from './routes/finances'
import publicationsRoutes from './routes/publications'
import partenairesRoutes from './routes/partenaires'
import visitesRoutes from './routes/visites'
import usersRoutes from './routes/users'
import logsRoutes from './routes/logs'
import commentsRoutes from './routes/comments'
import projectsRoutes from './routes/projects'

// Import des middlewares
import { errorHandler } from './middleware/errorHandler'
import { requestLogger } from './middleware/requestLogger'

// Configuration
const runtimeEnv = process.env.NODE_ENV || 'development'
const envPath = `.env.${runtimeEnv}`
const envResult = dotenv.config({ path: envPath })
if (envResult.error) {
  dotenv.config()
}

const app = express()
const PORT = process.env.PORT || 3001

// Configuration CORS
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://actionhub.globalsos.org',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004'
])

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origine non autorisée par CORS'))
  },
  credentials: true,
  optionsSuccessStatus: 200
}

// Middlewares globaux
app.use(helmet())
app.use(compression())
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par windowMs
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Logging des requêtes
app.use(requestLogger)

// Routes de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  })
})

// Routes API
app.use('/api/auth', authRoutes)
app.use('/api/demandes', demandesRoutes)
app.use('/api/finances', financesRoutes)
app.use('/api/publications', publicationsRoutes)
app.use('/api/partenaires', partenairesRoutes)
app.use('/api/visites', visitesRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/logs', logsRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api/projects', projectsRoutes)

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method
  })
})

// Gestionnaire d'erreurs global
app.use(errorHandler)

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur backend démarré sur le port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`)
})

export default app
