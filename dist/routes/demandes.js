"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const createDemandeSchema = zod_1.z.object({
    type: zod_1.z.enum(['ACHAT', 'DEPENSE', 'DOCUMENT', 'PUBLICATION']),
    description: zod_1.z.string().min(1, 'Description requise'),
    items: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        quantity: zod_1.z.number(),
        price: zod_1.z.number()
    })).optional(),
    totalAmount: zod_1.z.number().optional(),
    justificatif: zod_1.z.string().optional()
});
const updateDemandeSchema = zod_1.z.object({
    status: zod_1.z.enum(['EN_ATTENTE', 'VALIDE', 'REFUSE', 'EXECUTE']).optional(),
    motifRefus: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        quantity: zod_1.z.number(),
        price: zod_1.z.number()
    })).optional(),
    totalAmount: zod_1.z.number().optional()
});
router.get('/', auth_2.authenticateToken, async (req, res) => {
    try {
        const { status, type, userId, page = '1', limit = '50' } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        if (userId)
            where.userId = userId;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [demandes, total] = await Promise.all([
            auth_1.prisma.demande.findMany({
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
                take: parseInt(limit)
            }),
            auth_1.prisma.demande.count({ where })
        ]);
        res.json({
            demandes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Erreur lors de la récupération des demandes:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.post('/', auth_2.authenticateToken, async (req, res) => {
    try {
        const { type, description, items, totalAmount, justificatif } = createDemandeSchema.parse(req.body);
        const demande = await auth_1.prisma.demande.create({
            data: {
                type,
                description,
                items: items || null,
                totalAmount: totalAmount || null,
                justificatif: justificatif || null,
                userId: req.user.userId,
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
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'CREATE_DEMANDE',
                module: 'DEMANDES',
                details: `Demande ${demande.id} créée`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.status(201).json(demande);
    }
    catch (error) {
        console.error('Erreur lors de la création de la demande:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.get('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const demande = await auth_1.prisma.demande.findUnique({
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
        });
        if (!demande) {
            return res.status(404).json({ error: 'Demande non trouvée' });
        }
        res.json(demande);
    }
    catch (error) {
        console.error('Erreur lors de la récupération de la demande:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.put('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const { status, motifRefus, description, items, totalAmount } = updateDemandeSchema.parse(req.body);
        const existingDemande = await auth_1.prisma.demande.findUnique({
            where: { id: req.params.id }
        });
        if (!existingDemande) {
            return res.status(404).json({ error: 'Demande non trouvée' });
        }
        const canModify = req.user.role === 'ADMIN' ||
            req.user.role === 'COORDINATOR' ||
            (req.user.role === 'FINANCE' && ['ACHAT', 'DEPENSE'].includes(existingDemande.type));
        if (!canModify) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const updateData = {};
        if (status)
            updateData.status = status;
        if (motifRefus)
            updateData.motifRefus = motifRefus;
        if (description)
            updateData.description = description;
        if (items)
            updateData.items = items;
        if (totalAmount !== undefined)
            updateData.totalAmount = totalAmount;
        const demande = await auth_1.prisma.demande.update({
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
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'UPDATE_DEMANDE',
                module: 'DEMANDES',
                details: `Demande ${demande.id} mise à jour - Statut: ${status || 'modifié'}`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json(demande);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour de la demande:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.delete('/:id', auth_2.authenticateToken, auth_2.requireCoordinator, async (req, res) => {
    try {
        const existingDemande = await auth_1.prisma.demande.findUnique({
            where: { id: req.params.id }
        });
        if (!existingDemande) {
            return res.status(404).json({ error: 'Demande non trouvée' });
        }
        await auth_1.prisma.demande.delete({
            where: { id: req.params.id }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'DELETE_DEMANDE',
                module: 'DEMANDES',
                details: `Demande ${req.params.id} supprimée`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Erreur lors de la suppression de la demande:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.default = router;
//# sourceMappingURL=demandes.js.map