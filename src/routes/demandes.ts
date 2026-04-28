import { Router } from 'express'
import { prisma } from '../lib/auth'
import { authenticateToken, requireCoordinator, requireFinance, AuthenticatedRequest } from '../middleware/auth'
import { z } from 'zod'
import type { DemandeWhereInput, DemandeUpdateData } from '../types/database'

const router = Router()

// Schémas de validation
const createDemandeSchema = z.object({
  type: z.enum(['ACHAT', 'DEPENSE', 'DOCUMENT', 'PUBLICATION']),
  description: z.string().min(1, 'Description requise'),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    price: z.number()
  })).optional(),
  totalAmount: z.number().optional(),
  justificatif: z.string().optional()
})

const updateDemandeSchema = z.object({
  status: z.enum(['EN_ATTENTE', 'VALIDE', 'REFUSE', 'EXECUTE']).optional(),
  motifRefus: z.string().optional(),
  description: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    price: z.number()
  })).optional(),
  totalAmount: z.number().optional()
})

// GET /api/demandes - Récupérer toutes les demandes
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, type, userId, page = '1', limit = '50' } = req.query

    const where: DemandeWhereInput = {}
    
    if (status) where.status = status as string
    if (type) where.type = type as string
    if (userId) where.userId = userId as string

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const [demandes, total] = await Promise.all([
      prisma.demande.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          comments: {
            include: {
              user: {
                select: {
                  name: true,
                  role: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.demande.count({ where })
    ])

    res.json({
      demandes,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des demandes:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/demandes - Créer une nouvelle demande
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { type, description, items, totalAmount, justificatif } = createDemandeSchema.parse(req.body)

    const demande = await prisma.demande.create({
      data: {
        type,
        description,
        items: items || null,
        totalAmount: totalAmount || null,
        justificatif: justificatif || null,
        userId: req.user!.userId,
        status: 'EN_ATTENTE'
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
        action: 'CREATE_DEMANDE',
        module: 'DEMANDES',
        details: `Demande ${demande.id} créée`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.status(201).json(demande)
  } catch (error) {
    console.error('Erreur lors de la création de la demande:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/demandes/:id - Récupérer une demande spécifique
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const demande = await prisma.demande.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                name: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!demande) {
      return res.status(404).json({ error: 'Demande non trouvée' })
    }

    res.json(demande)
  } catch (error) {
    console.error('Erreur lors de la récupération de la demande:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PUT /api/demandes/:id - Mettre à jour une demande
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, motifRefus, description, items, totalAmount } = updateDemandeSchema.parse(req.body)

    const existingDemande = await prisma.demande.findUnique({
      where: { id: req.params.id }
    })

    if (!existingDemande) {
      return res.status(404).json({ error: 'Demande non trouvée' })
    }

    // Vérifier les permissions selon le rôle
    const canModify = req.user!.role === 'ADMIN' || 
                     req.user!.role === 'COORDINATOR' || 
                     (req.user!.role === 'FINANCE' && ['ACHAT', 'DEPENSE'].includes(existingDemande.type))

    if (!canModify) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const updateData: DemandeUpdateData = {}
    if (status) updateData.status = status
    if (motifRefus) updateData.motifRefus = motifRefus
    if (description) updateData.description = description
    if (items) updateData.items = items
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount

    const demande = await prisma.demande.update({
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
        action: 'UPDATE_DEMANDE',
        module: 'DEMANDES',
        details: `Demande ${demande.id} mise à jour - Statut: ${status || 'modifié'}`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json(demande)
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la demande:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/demandes/:id - Supprimer une demande
router.delete('/:id', authenticateToken, requireCoordinator, async (req: AuthenticatedRequest, res) => {
  try {
    const existingDemande = await prisma.demande.findUnique({
      where: { id: req.params.id }
    })

    if (!existingDemande) {
      return res.status(404).json({ error: 'Demande non trouvée' })
    }

    await prisma.demande.delete({
      where: { id: req.params.id }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'DELETE_DEMANDE',
        module: 'DEMANDES',
        details: `Demande ${req.params.id} supprimée`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression de la demande:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
