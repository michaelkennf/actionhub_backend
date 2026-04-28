import { Router } from 'express'
import { prisma } from '../lib/auth'
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth'
import { Prisma } from '@prisma/client'

const router = Router()

// GET /api/logs - Récupérer tous les logs système
router.get('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { module, action, userId, startDate, endDate, page = '1', limit = '50' } = req.query

    const where: Prisma.LogWhereInput = {}
    
    if (module) where.module = module as string
    if (action) where.action = action as string
    if (userId) where.userId = userId as string
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const [logs, total] = await Promise.all([
      prisma.log.findMany({
        where,
        include: {
          user: {
            select: {
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
      prisma.log.count({ where })
    ])

    res.json({
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des logs:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
