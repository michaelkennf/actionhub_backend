import { Router } from 'express'
import { prisma } from '../lib/auth'
import { authenticateToken, requireLogistics, AuthenticatedRequest } from '../middleware/auth'
import { z } from 'zod'
import type { VisiteWhereInput } from '../types/database'

const router = Router()

// Schémas de validation
const createVisiteSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  postnom: z.string().min(1, 'Postnom requis'),
  motif: z.string().min(1, 'Motif requis'),
  hote: z.string().min(1, 'Hôte requis'),
  heureArrivee: z.string().datetime().optional(),
  heureSortie: z.string().datetime().optional(),
  type: z.enum(['TERRAIN', 'INSPECTION', 'RENCONTRE', 'FORMATION']).optional(),
  status: z.enum(['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE']).optional()
})

const updateVisiteSchema = z.object({
  nom: z.string().optional(),
  postnom: z.string().optional(),
  motif: z.string().optional(),
  hote: z.string().optional(),
  heureArrivee: z.string().datetime().optional(),
  heureSortie: z.string().datetime().optional(),
  type: z.enum(['TERRAIN', 'INSPECTION', 'RENCONTRE', 'FORMATION']).optional(),
  status: z.enum(['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE']).optional()
})

// GET /api/visites - Récupérer toutes les visites
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, type, startDate, endDate, userId, page = '1', limit = '50' } = req.query

    const where: VisiteWhereInput = {}
    
    if (status) where.status = status as string
    if (type) where.type = type as string
    if (userId) where.userId = userId as string
    if (startDate && endDate) {
      where.heureArrivee = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const [visites, total] = await Promise.all([
      prisma.visite.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: {
          heureArrivee: 'desc'
        },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.visite.count({ where })
    ])

    res.json({
      visites,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des visites:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/visites - Créer une nouvelle visite
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Vérifier les permissions
    const canCreate = ['COORDINATOR', 'LOGISTICS', 'ADMIN'].includes(req.user!.role)
    if (!canCreate) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const { nom, postnom, motif, hote, heureArrivee, heureSortie, type, status } = createVisiteSchema.parse(req.body)

    const visite = await prisma.visite.create({
      data: {
        nom,
        postnom,
        motif,
        hote,
        heureArrivee: heureArrivee ? new Date(heureArrivee) : new Date(),
        heureSortie: heureSortie ? new Date(heureSortie) : null,
        type: type || 'TERRAIN',
        status: status || 'PLANIFIEE',
        userId: req.user!.userId
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'CREATE_VISITE',
        module: 'VISITES',
        details: `Visite ${visite.id} créée: ${nom} ${postnom}`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.status(201).json(visite)
  } catch (error) {
    console.error('Erreur lors de la création de la visite:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/visites/:id - Récupérer une visite spécifique
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const visite = await prisma.visite.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    if (!visite) {
      return res.status(404).json({ error: 'Visite non trouvée' })
    }

    res.json(visite)
  } catch (error) {
    console.error('Erreur lors de la récupération de la visite:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PUT /api/visites/:id - Mettre à jour une visite
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { nom, postnom, motif, hote, heureArrivee, heureSortie, type, status } = updateVisiteSchema.parse(req.body)

    const existingVisite = await prisma.visite.findUnique({
      where: { id: req.params.id }
    })

    if (!existingVisite) {
      return res.status(404).json({ error: 'Visite non trouvée' })
    }

    // Vérifier les permissions
    const canModify = ['COORDINATOR', 'LOGISTICS', 'ADMIN'].includes(req.user!.role) ||
                     existingVisite.userId === req.user!.userId

    if (!canModify) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const updateData: any = {}
    if (nom) updateData.nom = nom
    if (postnom) updateData.postnom = postnom
    if (motif) updateData.motif = motif
    if (hote) updateData.hote = hote
    if (heureArrivee) updateData.heureArrivee = new Date(heureArrivee)
    if (heureSortie) updateData.heureSortie = new Date(heureSortie)
    if (type) updateData.type = type
    if (status) updateData.status = status

    const visite = await prisma.visite.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'UPDATE_VISITE',
        module: 'VISITES',
        details: `Visite ${visite.id} mise à jour`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json(visite)
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la visite:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/visites/:id - Supprimer une visite
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const existingVisite = await prisma.visite.findUnique({
      where: { id: req.params.id }
    })

    if (!existingVisite) {
      return res.status(404).json({ error: 'Visite non trouvée' })
    }

    // Seuls les admins et les créateurs peuvent supprimer
    const canDelete = req.user!.role === 'ADMIN' || existingVisite.userId === req.user!.userId

    if (!canDelete) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    await prisma.visite.delete({
      where: { id: req.params.id }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'DELETE_VISITE',
        module: 'VISITES',
        details: `Visite ${req.params.id} supprimée`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression de la visite:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
