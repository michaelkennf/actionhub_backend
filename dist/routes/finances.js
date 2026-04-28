"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const createTransactionSchema = zod_1.z.object({
    type: zod_1.z.enum(['entree', 'sortie']),
    montant: zod_1.z.number().positive('Le montant doit être positif'),
    description: zod_1.z.string().min(1, 'Description requise'),
    dateTransaction: zod_1.z.string().datetime().optional(),
    modePaiement: zod_1.z.string().optional(),
    reference: zod_1.z.string().optional(),
    demandeId: zod_1.z.string().optional()
});
router.get('/overview', auth_2.authenticateToken, auth_2.requireFinance, async (req, res) => {
    try {
        const { year, month } = req.query;
        const currentYear = parseInt(year) || new Date().getFullYear();
        const currentMonth = month ? parseInt(month) - 1 : null;
        const startDate = new Date(currentYear, currentMonth || 0, 1);
        const endDate = new Date(currentYear, currentMonth ? currentMonth + 1 : 12, 0);
        const transactions = await auth_1.prisma.transaction.findMany({
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
        });
        const totalEntrees = transactions
            .filter(t => t.type === 'entree')
            .reduce((sum, t) => sum + t.montant, 0);
        const totalSorties = transactions
            .filter(t => t.type === 'sortie')
            .reduce((sum, t) => sum + t.montant, 0);
        const solde = totalEntrees - totalSorties;
        const demandesAvecMontants = await auth_1.prisma.demande.findMany({
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
        });
        const budgetParCategorie = demandesAvecMontants.reduce((acc, demande) => {
            const categorie = demande.type;
            if (!acc[categorie]) {
                acc[categorie] = { allocated: 0, spent: 0 };
            }
            acc[categorie].allocated += demande.totalAmount || 0;
            if (demande.status === 'EXECUTE') {
                acc[categorie].spent += demande.totalAmount || 0;
            }
            return acc;
        }, {});
        res.json({
            transactions,
            stats: {
                totalEntrees,
                totalSorties,
                solde,
                nombreTransactions: transactions.length
            },
            budgetParCategorie
        });
    }
    catch (error) {
        console.error('Erreur lors de la récupération des finances:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.get('/transactions', auth_2.authenticateToken, auth_2.requireFinance, async (req, res) => {
    try {
        const { type, startDate, endDate } = req.query;
        const where = {};
        if (type)
            where.type = type;
        if (startDate && endDate) {
            where.dateTransaction = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }
        const transactions = await auth_1.prisma.transaction.findMany({
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
        });
        res.json(transactions);
    }
    catch (error) {
        console.error('Erreur lors de la récupération des transactions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.post('/transactions', auth_2.authenticateToken, auth_2.requireFinance, async (req, res) => {
    try {
        const { type, montant, description, dateTransaction, modePaiement, reference, demandeId } = createTransactionSchema.parse(req.body);
        const transaction = await auth_1.prisma.transaction.create({
            data: {
                type,
                montant: parseFloat(montant.toString()),
                description,
                dateTransaction: dateTransaction ? new Date(dateTransaction) : new Date(),
                modePaiement: modePaiement || null,
                reference: reference || null,
                demandeId: demandeId || null,
                userId: req.user.userId
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'CREATE_TRANSACTION',
                module: 'FINANCES',
                details: `Transaction ${transaction.id} créée - ${type} ${montant}`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.status(201).json(transaction);
    }
    catch (error) {
        console.error('Erreur lors de la création de la transaction:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.default = router;
//# sourceMappingURL=finances.js.map