"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const createPartenaireSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nom requis'),
    contact: zod_1.z.string().min(1, 'Contact requis'),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    domaine: zod_1.z.string().min(1, 'Domaine requis'),
    contratUrl: zod_1.z.string().optional()
});
const updatePartenaireSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    contact: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    domaine: zod_1.z.string().optional(),
    contratUrl: zod_1.z.string().optional(),
    active: zod_1.z.boolean().optional()
});
router.get('/', auth_2.authenticateToken, async (req, res) => {
    try {
        const { status, domaine, page = '1', limit = '50' } = req.query;
        const where = {};
        if (status)
            where.active = status === 'ACTIF';
        if (domaine)
            where.domaine = { contains: domaine, mode: 'insensitive' };
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [partenaires, total] = await Promise.all([
            auth_1.prisma.partenaire.findMany({
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
                take: parseInt(limit)
            }),
            auth_1.prisma.partenaire.count({ where })
        ]);
        res.json({
            partenaires,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Erreur lors de la récupération des partenaires:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.post('/', auth_2.authenticateToken, async (req, res) => {
    try {
        const canCreate = ['COORDINATOR', 'COMMUNICATION', 'ADMIN'].includes(req.user.role);
        if (!canCreate) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const { name, contact, email, phone, domaine, contratUrl } = createPartenaireSchema.parse(req.body);
        const partenaire = await auth_1.prisma.partenaire.create({
            data: {
                name,
                contact,
                email: email || null,
                phone: phone || null,
                domaine,
                contratUrl: contratUrl || null,
                active: true
            }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'CREATE_PARTENAIRE',
                module: 'PARTENAIRES',
                details: `Partenaire ${partenaire.id} créé: ${name}`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.status(201).json(partenaire);
    }
    catch (error) {
        console.error('Erreur lors de la création du partenaire:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.get('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const partenaire = await auth_1.prisma.partenaire.findUnique({
            where: { id: req.params.id },
            include: {
                rapports: {
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });
        if (!partenaire) {
            return res.status(404).json({ error: 'Partenaire non trouvé' });
        }
        res.json(partenaire);
    }
    catch (error) {
        console.error('Erreur lors de la récupération du partenaire:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.put('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const { name, contact, email, phone, domaine, contratUrl, active } = updatePartenaireSchema.parse(req.body);
        const existingPartenaire = await auth_1.prisma.partenaire.findUnique({
            where: { id: req.params.id }
        });
        if (!existingPartenaire) {
            return res.status(404).json({ error: 'Partenaire non trouvé' });
        }
        const canModify = ['COORDINATOR', 'COMMUNICATION', 'ADMIN'].includes(req.user.role);
        if (!canModify) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const updateData = {};
        if (name)
            updateData.name = name;
        if (contact)
            updateData.contact = contact;
        if (email !== undefined)
            updateData.email = email;
        if (phone !== undefined)
            updateData.phone = phone;
        if (domaine)
            updateData.domaine = domaine;
        if (contratUrl !== undefined)
            updateData.contratUrl = contratUrl;
        if (active !== undefined)
            updateData.active = active;
        const partenaire = await auth_1.prisma.partenaire.update({
            where: { id: req.params.id },
            data: updateData
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'UPDATE_PARTENAIRE',
                module: 'PARTENAIRES',
                details: `Partenaire ${partenaire.id} mis à jour`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json(partenaire);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour du partenaire:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.delete('/:id', auth_2.authenticateToken, auth_2.requireAdmin, async (req, res) => {
    try {
        const existingPartenaire = await auth_1.prisma.partenaire.findUnique({
            where: { id: req.params.id }
        });
        if (!existingPartenaire) {
            return res.status(404).json({ error: 'Partenaire non trouvé' });
        }
        await auth_1.prisma.partenaire.delete({
            where: { id: req.params.id }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'DELETE_PARTENAIRE',
                module: 'PARTENAIRES',
                details: `Partenaire ${req.params.id} supprimé`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Erreur lors de la suppression du partenaire:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.default = router;
//# sourceMappingURL=partenaires.js.map