import { Router } from 'express'
import { prisma } from '../lib/auth'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const router = Router()

// Schémas de validation
const createPartenaireSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  contact: z.string().min(1, 'Contact requis'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  domaine: z.string().min(1, 'Domaine requis'),
  contratUrl: z.string().optional()
})

const updatePartenaireSchema = z.object({
  name: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  domaine: z.string().optional(),
  contratUrl: z.string().optional(),
  active: z.boolean().optional()
})

// GET /api/partenaires - Récupérer tous les partenaires
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, domaine, page = '1', limit = '50' } = req.query

    const where: Prisma.PartenaireWhereInput = {}
    
    if (status) where.active = status === 'ACTIF'
    if (domaine) where.domaine = { contains: domaine as string, mode: 'insensitive' }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const [partenaires, total] = await Promise.all([
      prisma.partenaire.findMany({
        where,
        include: {
          rapports: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 5
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.partenaire.count({ where })
    ])

    res.json({
      partenaires,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des partenaires:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/partenaires - Créer un nouveau partenaire
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Vérifier les permissions
    const canCreate = ['COORDINATOR', 'COMMUNICATION', 'ADMIN'].includes(req.user!.role)
    if (!canCreate) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const { name, contact, email, phone, domaine, contratUrl } = createPartenaireSchema.parse(req.body)

    const partenaire = await prisma.partenaire.create({
      data: {
        name,
        contact,
        email: email || null,
        phone: phone || null,
        domaine,
        contratUrl: contratUrl || null,
        active: true
      }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'CREATE_PARTENAIRE',
        module: 'PARTENAIRES',
        details: `Partenaire ${partenaire.id} créé: ${name}`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.status(201).json(partenaire)
  } catch (error) {
    console.error('Erreur lors de la création du partenaire:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/partenaires/:id - Récupérer un partenaire spécifique
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const partenaire = await prisma.partenaire.findUnique({
      where: { id: req.params.id },
      include: {
        rapports: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!partenaire) {
      return res.status(404).json({ error: 'Partenaire non trouvé' })
    }

    res.json(partenaire)
  } catch (error) {
    console.error('Erreur lors de la récupération du partenaire:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// PUT /api/partenaires/:id - Mettre à jour un partenaire
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, contact, email, phone, domaine, contratUrl, active } = updatePartenaireSchema.parse(req.body)

    const existingPartenaire = await prisma.partenaire.findUnique({
      where: { id: req.params.id }
    })

    if (!existingPartenaire) {
      return res.status(404).json({ error: 'Partenaire non trouvé' })
    }

    // Vérifier les permissions
    const canModify = ['COORDINATOR', 'COMMUNICATION', 'ADMIN'].includes(req.user!.role)
    if (!canModify) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const updateData: any = {}
    if (name) updateData.name = name
    if (contact) updateData.contact = contact
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (domaine) updateData.domaine = domaine
    if (contratUrl !== undefined) updateData.contratUrl = contratUrl
    if (active !== undefined) updateData.active = active

    const partenaire = await prisma.partenaire.update({
      where: { id: req.params.id },
      data: updateData
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'UPDATE_PARTENAIRE',
        module: 'PARTENAIRES',
        details: `Partenaire ${partenaire.id} mis à jour`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json(partenaire)
  } catch (error) {
    console.error('Erreur lors de la mise à jour du partenaire:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// DELETE /api/partenaires/:id - Supprimer un partenaire
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const existingPartenaire = await prisma.partenaire.findUnique({
      where: { id: req.params.id }
    })

    if (!existingPartenaire) {
      return res.status(404).json({ error: 'Partenaire non trouvé' })
    }

    await prisma.partenaire.delete({
      where: { id: req.params.id }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'DELETE_PARTENAIRE',
        module: 'PARTENAIRES',
        details: `Partenaire ${req.params.id} supprimé`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression du partenaire:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
