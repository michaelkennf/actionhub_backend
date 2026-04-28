import { Router } from 'express'
import { prisma, hashPassword } from '../lib/auth'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const router = Router()

// Schémas de validation
const createUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
  name: z.string().min(1, 'Nom requis'),
  role: z.enum(['COORDINATOR', 'FINANCE', 'COMMUNICATION', 'LOGISTICS', 'MEAL', 'ADMIN'])
})

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  name: z.string().optional(),
  role: z.enum(['COORDINATOR', 'FINANCE', 'COMMUNICATION', 'LOGISTICS', 'MEAL', 'ADMIN']).optional(),
  active: z.boolean().optional()
})

// GET /api/users - Récupérer tous les utilisateurs
router.get('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { role, active, page = '1', limit = '50' } = req.query

    const where: Prisma.UserWhereInput = {}
    
    if (role) where.role = role as string
    if (active !== undefined) where.active = active === 'true'

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.user.count({ where })
    ])

    res.json({
      users,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/users - Créer un nouvel utilisateur
router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, password, name, role } = createUserSchema.parse(req.body)

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
        module: 'USERS',
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

// GET /api/users/:id - Récupérer un utilisateur spécifique
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Un utilisateur peut voir ses propres infos, les admins peuvent voir tous
    if (req.user!.role !== 'ADMIN' && req.user!.userId !== req.params.id) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }

    res.json(user)
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PUT /api/users/:id - Mettre à jour un utilisateur
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, password, name, role, active } = updateUserSchema.parse(req.body)

    const existingUser = await prisma.user.findUnique({
      where: { id: req.params.id }
    })

    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }

    // Vérifier les permissions
    const canModify = req.user!.role === 'ADMIN' || req.user!.userId === req.params.id

    if (!canModify) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    // Un utilisateur non-admin ne peut pas changer son rôle ou son statut actif
    const updateData: Prisma.UserUpdateInput = {}
    if (email) updateData.email = email
    if (password) updateData.password = await hashPassword(password)
    if (name) updateData.name = name
    if (req.user!.role === 'ADMIN') {
      if (role) updateData.role = role as string
      if (active !== undefined) updateData.active = active
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        updatedAt: true
      }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'UPDATE_USER',
        module: 'USERS',
        details: `Utilisateur ${user.id} mis à jour`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json(user)
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/users/:id - Supprimer un utilisateur
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Un admin ne peut pas se supprimer lui-même
    if (req.user!.userId === req.params.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' })
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: req.params.id }
    })

    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }

    await prisma.user.delete({
      where: { id: req.params.id }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'DELETE_USER',
        module: 'USERS',
        details: `Utilisateur ${req.params.id} supprimé`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
