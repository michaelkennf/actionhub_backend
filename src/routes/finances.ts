import { Router } from 'express'
import { prisma } from '../lib/auth'
import { authenticateToken, requireFinance, AuthenticatedRequest } from '../middleware/auth'
import { z } from 'zod'

const router = Router()

// Schémas de validation
const createTransactionSchema = z.object({
  type: z.enum(['entree', 'sortie']),
  montant: z.number().positive('Le montant doit être positif'),
  description: z.string().min(1, 'Description requise'),
  dateTransaction: z.string().datetime().optional(),
  modePaiement: z.string().optional(),
  reference: z.string().optional(),
  demandeId: z.string().optional()
})

// GET /api/finances/overview - Vue d'ensemble financière
router.get('/overview', authenticateToken, requireFinance, async (req: AuthenticatedRequest, res) => {
  try {
    const { year, month } = req.query
    const currentYear = parseInt(year as string) || new Date().getFullYear()
    const currentMonth = month ? parseInt(month as string) - 1 : null

    // Calculer les dates de début et fin
    const startDate = new Date(currentYear, currentMonth || 0, 1)
    const endDate = new Date(currentYear, currentMonth ? currentMonth + 1 : 12, 0)

    // Récupérer toutes les transactions de la période
    const transactions = await prisma.transaction.findMany({
      where: {
        dateTransaction: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        dateTransaction: 'desc'
      }
    })

    // Calculer les statistiques
    const totalEntrees = transactions
      .filter(t => t.type === 'entree')
      .reduce((sum, t) => sum + t.montant, 0)

    const totalSorties = transactions
      .filter(t => t.type === 'sortie')
      .reduce((sum, t) => sum + t.montant, 0)

    const solde = totalEntrees - totalSorties

    // Récupérer les demandes avec montants
    const demandesAvecMontants = await prisma.demande.findMany({
      where: {
        totalAmount: {
          not: null
        },
        status: {
          in: ['VALIDE', 'EXECUTE']
        }
      },
      select: {
        type: true,
        totalAmount: true,
        status: true
      }
    })

    // Calculer le budget par catégorie
    const budgetParCategorie = demandesAvecMontants.reduce((acc, demande) => {
      const categorie = demande.type
      if (!acc[categorie]) {
        acc[categorie] = { allocated: 0, spent: 0 }
      }
      acc[categorie].allocated += demande.totalAmount || 0
      if (demande.status === 'EXECUTE') {
        acc[categorie].spent += demande.totalAmount || 0
      }
      return acc
    }, {} as Record<string, { allocated: number; spent: number }>)

    res.json({
      transactions,
      stats: {
        totalEntrees,
        totalSorties,
        solde,
        nombreTransactions: transactions.length
      },
      budgetParCategorie
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des finances:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/finances/transactions - Récupérer toutes les transactions
router.get('/transactions', authenticateToken, requireFinance, async (req: AuthenticatedRequest, res) => {
  try {
    const { type, startDate, endDate } = req.query

    const where: any = {}
    
    if (type) where.type = type
    if (startDate && endDate) {
      where.dateTransaction = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        dateTransaction: 'desc'
      }
    })

    res.json(transactions)
  } catch (error) {
    console.error('Erreur lors de la récupération des transactions:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/finances/transactions - Créer une nouvelle transaction
router.post('/transactions', authenticateToken, requireFinance, async (req: AuthenticatedRequest, res) => {
  try {
    const { type, montant, description, dateTransaction, modePaiement, reference, demandeId } = createTransactionSchema.parse(req.body)

    const transaction = await prisma.transaction.create({
      data: {
        type,
        montant: parseFloat(montant.toString()),
        description,
        dateTransaction: dateTransaction ? new Date(dateTransaction) : new Date(),
        modePaiement: modePaiement || null,
        reference: reference || null,
        demandeId: demandeId || null,
        userId: req.user!.userId
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    // Créer un log
    await prisma.log.create({
      data: {
        action: 'CREATE_TRANSACTION',
        module: 'FINANCES',
        details: `Transaction ${transaction.id} créée - ${type} ${montant}`,
        ipAddress: req.ip,
        userId: req.user!.userId
      }
    })

    res.status(201).json(transaction)
  } catch (error) {
    console.error('Erreur lors de la création de la transaction:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
