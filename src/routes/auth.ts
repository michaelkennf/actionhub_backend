import { Router } from 'express'
import { prisma, hashPassword, verifyPassword, createToken } from '../lib/auth'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { z } from 'zod'

const router = Router()

function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
}

// Schémas de validation
const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis')
})

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
  name: z.string().min(1, 'Nom requis'),
  role: z.enum(['COORDINATOR', 'FINANCE', 'COMMUNICATION', 'LOGISTICS', 'MEAL', 'ADMIN'])
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Compte désactivé' })
    }

    // Vérifier le mot de passe
    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
    }

    // Créer le token JWT
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    // Définir le cookie
    res.cookie('token', token, getAuthCookieOptions())

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'LOGIN',
        module: 'AUTH',
        details: `Connexion réussie pour ${email}`,
        ipAddress: req.ip,
        userId: user.id
      }
    })

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Erreur de connexion:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Supprimer le cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
      domain: process.env.COOKIE_DOMAIN || undefined,
      path: '/',
    })
    
    // Créer un log
    await prisma.log.create({
      data: {
        action: 'LOGOUT',
        module: 'AUTH',
        details: `Déconnexion de ${req.user?.email}`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Erreur de déconnexion:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    res.json({
      user: {
        id: req.user!.userId,
        email: req.user!.email,
        name: req.user!.name,
        role: req.user!.role
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des informations utilisateur:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/auth/register (Admin seulement)
router.post('/register', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const { email, password, name, role } = registerSchema.parse(req.body)

    // Vérifier que l'email n'existe pas déjà
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' })
    }

    // Hacher le mot de passe
    const hashedPassword = await hashPassword(password)

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        active: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true
      }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'CREATE_USER',
        module: 'AUTH',
        details: `Utilisateur ${user.id} créé: ${email}`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.status(201).json(user)
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
