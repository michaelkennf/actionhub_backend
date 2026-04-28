"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const createVisiteSchema = zod_1.z.object({
    nom: zod_1.z.string().min(1, 'Nom requis'),
    postnom: zod_1.z.string().min(1, 'Postnom requis'),
    motif: zod_1.z.string().min(1, 'Motif requis'),
    hote: zod_1.z.string().min(1, 'Hôte requis'),
    heureArrivee: zod_1.z.string().datetime().optional(),
    heureSortie: zod_1.z.string().datetime().optional(),
    type: zod_1.z.enum(['TERRAIN', 'INSPECTION', 'RENCONTRE', 'FORMATION']).optional(),
    status: zod_1.z.enum(['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE']).optional()
});
const updateVisiteSchema = zod_1.z.object({
    nom: zod_1.z.string().optional(),
    postnom: zod_1.z.string().optional(),
    motif: zod_1.z.string().optional(),
    hote: zod_1.z.string().optional(),
    heureArrivee: zod_1.z.string().datetime().optional(),
    heureSortie: zod_1.z.string().datetime().optional(),
    type: zod_1.z.enum(['TERRAIN', 'INSPECTION', 'RENCONTRE', 'FORMATION']).optional(),
    status: zod_1.z.enum(['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE']).optional()
});
router.get('/', auth_2.authenticateToken, async (req, res) => {
    try {
        const { status, type, startDate, endDate, userId, page = '1', limit = '50' } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        if (userId)
            where.userId = userId;
        if (startDate && endDate) {
            where.heureArrivee = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [visites, total] = await Promise.all([
            auth_1.prisma.visite.findMany({
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
                take: parseInt(limit)
            }),
            auth_1.prisma.visite.count({ where })
        ]);
        res.json({
            visites,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Erreur lors de la récupération des visites:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.post('/', auth_2.authenticateToken, async (req, res) => {
    try {
        const canCreate = ['COORDINATOR', 'LOGISTICS', 'ADMIN'].includes(req.user.role);
        if (!canCreate) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const { nom, postnom, motif, hote, heureArrivee, heureSortie, type, status } = createVisiteSchema.parse(req.body);
        const visite = await auth_1.prisma.visite.create({
            data: {
                nom,
                postnom,
                motif,
                hote,
                heureArrivee: heureArrivee ? new Date(heureArrivee) : new Date(),
                heureSortie: heureSortie ? new Date(heureSortie) : null,
                type: type || 'TERRAIN',
                status: status || 'PLANIFIEE',
                userId: req.user.userId
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
                action: 'CREATE_VISITE',
                module: 'VISITES',
                details: `Visite ${visite.id} créée: ${nom} ${postnom}`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.status(201).json(visite);
    }
    catch (error) {
        console.error('Erreur lors de la création de la visite:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.get('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const visite = await auth_1.prisma.visite.findUnique({
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
        });
        if (!visite) {
            return res.status(404).json({ error: 'Visite non trouvée' });
        }
        res.json(visite);
    }
    catch (error) {
        console.error('Erreur lors de la récupération de la visite:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.put('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const { nom, postnom, motif, hote, heureArrivee, heureSortie, type, status } = updateVisiteSchema.parse(req.body);
        const existingVisite = await auth_1.prisma.visite.findUnique({
            where: { id: req.params.id }
        });
        if (!existingVisite) {
            return res.status(404).json({ error: 'Visite non trouvée' });
        }
        const canModify = ['COORDINATOR', 'LOGISTICS', 'ADMIN'].includes(req.user.role) ||
            existingVisite.userId === req.user.userId;
        if (!canModify) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const updateData = {};
        if (nom)
            updateData.nom = nom;
        if (postnom)
            updateData.postnom = postnom;
        if (motif)
            updateData.motif = motif;
        if (hote)
            updateData.hote = hote;
        if (heureArrivee)
            updateData.heureArrivee = new Date(heureArrivee);
        if (heureSortie)
            updateData.heureSortie = new Date(heureSortie);
        if (type)
            updateData.type = type;
        if (status)
            updateData.status = status;
        const visite = await auth_1.prisma.visite.update({
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
                action: 'UPDATE_VISITE',
                module: 'VISITES',
                details: `Visite ${visite.id} mise à jour`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json(visite);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour de la visite:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.delete('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const existingVisite = await auth_1.prisma.visite.findUnique({
            where: { id: req.params.id }
        });
        if (!existingVisite) {
            return res.status(404).json({ error: 'Visite non trouvée' });
        }
        const canDelete = req.user.role === 'ADMIN' || existingVisite.userId === req.user.userId;
        if (!canDelete) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        await auth_1.prisma.visite.delete({
            where: { id: req.params.id }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'DELETE_VISITE',
                module: 'VISITES',
                details: `Visite ${req.params.id} supprimée`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Erreur lors de la suppression de la visite:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.default = router;
//# sourceMappingURL=visites.js.map