import { Router } from 'express'
import { prisma } from '../lib/auth'
import { authenticateToken, requireCommunication, AuthenticatedRequest } from '../middleware/auth'
import { z } from 'zod'
import type { PublicationWhereInput, PublicationUpdateData } from '../types/database'

const router = Router()

// Schémas de validation
const createPublicationSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  content: z.string().min(1, 'Contenu requis'),
  imageUrl: z.string().optional(),
  type: z.string().optional()
})

const updatePublicationSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  status: z.enum(['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'REFUSE']).optional(),
  motifRefus: z.string().optional()
})

// GET /api/publications - Récupérer toutes les publications
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, type, userId, page = '1', limit = '50' } = req.query

    const where: PublicationWhereInput = {}
    
    if (status) where.status = status as string
    if (type) where.type = type as string
    if (userId) where.userId = userId as string

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const [publications, total] = await Promise.all([
      prisma.publication.findMany({
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
      prisma.publication.count({ where })
    ])

    res.json({
      publications,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des publications:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/publications - Créer une nouvelle publication
router.post('/', authenticateToken, requireCommunication, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, content, imageUrl, type } = createPublicationSchema.parse(req.body)

    const publication = await prisma.publication.create({
      data: {
        title,
        content,
        imageUrl: imageUrl || '/placeholder.svg',
        type: type || 'ARTICLE',
        userId: req.user!.userId,
        status: 'BROUILLON'
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
        action: 'CREATE_PUBLICATION',
        module: 'PUBLICATIONS',
        details: `Publication ${publication.id} créée`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.status(201).json(publication)
  } catch (error) {
    console.error('Erreur lors de la création de la publication:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/publications/:id - Récupérer une publication spécifique
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const publication = await prisma.publication.findUnique({
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

    if (!publication) {
      return res.status(404).json({ error: 'Publication non trouvée' })
    }

    res.json(publication)
  } catch (error) {
    console.error('Erreur lors de la récupération de la publication:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PUT /api/publications/:id - Mettre à jour une publication
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, content, imageUrl, status, motifRefus } = updatePublicationSchema.parse(req.body)

    const existingPublication = await prisma.publication.findUnique({
      where: { id: req.params.id }
    })

    if (!existingPublication) {
      return res.status(404).json({ error: 'Publication non trouvée' })
    }

    // Vérifier les permissions
    const canModify = req.user!.role === 'ADMIN' || 
                     req.user!.role === 'COMMUNICATION' ||
                     existingPublication.userId === req.user!.userId

    if (!canModify) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const updateData: any = {}
    if (title) updateData.title = title
    if (content) updateData.content = content
    if (imageUrl) updateData.imageUrl = imageUrl
    if (status) updateData.status = status
    if (motifRefus) updateData.motifRefus = motifRefus

    const publication = await prisma.publication.update({
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
        action: 'UPDATE_PUBLICATION',
        module: 'PUBLICATIONS',
        details: `Publication ${publication.id} mise à jour - Statut: ${status || 'modifié'}`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json(publication)
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la publication:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/publications/:id - Supprimer une publication
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const existingPublication = await prisma.publication.findUnique({
      where: { id: req.params.id }
    })

    if (!existingPublication) {
      return res.status(404).json({ error: 'Publication non trouvée' })
    }

    // Seuls les admins et les créateurs peuvent supprimer
    const canDelete = req.user!.role === 'ADMIN' || existingPublication.userId === req.user!.userId

    if (!canDelete) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    await prisma.publication.delete({
      where: { id: req.params.id }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'DELETE_PUBLICATION',
        module: 'PUBLICATIONS',
        details: `Publication ${req.params.id} supprimée`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression de la publication:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
