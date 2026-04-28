import { Router } from 'express'
import { prisma } from '../lib/auth'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const router = Router()

// Schémas de validation
const createCommentSchema = z.object({
  content: z.string().min(1, 'Contenu requis'),
  demandeId: z.string().optional(),
  documentId: z.string().optional(),
  publicationId: z.string().optional()
})

const updateCommentSchema = z.object({
  content: z.string().min(1, 'Contenu requis')
})

// GET /api/comments - Récupérer tous les commentaires
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { demandeId, documentId, publicationId, page = '1', limit = '50' } = req.query

    const where: Prisma.CommentWhereInput = {}
    
    if (demandeId) where.demandeId = demandeId as string
    if (documentId) where.documentId = documentId as string
    if (publicationId) where.publicationId = publicationId as string

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
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
          createdAt: 'desc'
        },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.comment.count({ where })
    ])

    res.json({
      comments,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/comments - Créer un nouveau commentaire
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { content, demandeId, documentId, publicationId } = createCommentSchema.parse(req.body)

    // Vérifier qu'au moins une entité est spécifiée
    if (!demandeId && !documentId && !publicationId) {
      return res.status(400).json({ error: 'Une entité doit être spécifiée' })
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId: req.user!.userId,
        demandeId: demandeId || null,
        documentId: documentId || null,
        publicationId: publicationId || null
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
        action: 'CREATE_COMMENT',
        module: 'COMMENTS',
        details: `Commentaire ${comment.id} créé`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.status(201).json(comment)
  } catch (error) {
    console.error('Erreur lors de la création du commentaire:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/comments/:id - Récupérer un commentaire spécifique
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const comment = await prisma.comment.findUnique({
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

    if (!comment) {
      return res.status(404).json({ error: 'Commentaire non trouvé' })
    }

    res.json(comment)
  } catch (error) {
    console.error('Erreur lors de la récupération du commentaire:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PUT /api/comments/:id - Mettre à jour un commentaire
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = updateCommentSchema.parse(req.body)

    const existingComment = await prisma.comment.findUnique({
      where: { id: req.params.id }
    })

    if (!existingComment) {
      return res.status(404).json({ error: 'Commentaire non trouvé' })
    }

    // Vérifier que l'utilisateur est le propriétaire
    if (existingComment.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const comment = await prisma.comment.update({
      where: { id: req.params.id },
      data: { content },
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
        action: 'UPDATE_COMMENT',
        module: 'COMMENTS',
        details: `Commentaire ${comment.id} mis à jour`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json(comment)
  } catch (error) {
    console.error('Erreur lors de la mise à jour du commentaire:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/comments/:id - Supprimer un commentaire
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const existingComment = await prisma.comment.findUnique({
      where: { id: req.params.id }
    })

    if (!existingComment) {
      return res.status(404).json({ error: 'Commentaire non trouvé' })
    }

    // Vérifier que l'utilisateur est le propriétaire ou admin
    if (existingComment.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    await prisma.comment.delete({
      where: { id: req.params.id }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'DELETE_COMMENT',
        module: 'COMMENTS',
        details: `Commentaire ${req.params.id} supprimé`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression du commentaire:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
