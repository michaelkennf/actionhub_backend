"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const createPublicationSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Titre requis'),
    content: zod_1.z.string().min(1, 'Contenu requis'),
    imageUrl: zod_1.z.string().optional(),
    type: zod_1.z.string().optional()
});
const updatePublicationSchema = zod_1.z.object({
    title: zod_1.z.string().optional(),
    content: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().optional(),
    status: zod_1.z.enum(['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'REFUSE']).optional(),
    motifRefus: zod_1.z.string().optional()
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
        const [publications, total] = await Promise.all([
            auth_1.prisma.publication.findMany({
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
            auth_1.prisma.publication.count({ where })
        ]);
        res.json({
            publications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Erreur lors de la récupération des publications:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.post('/', auth_2.authenticateToken, auth_2.requireCommunication, async (req, res) => {
    try {
        const { title, content, imageUrl, type } = createPublicationSchema.parse(req.body);
        const publication = await auth_1.prisma.publication.create({
            data: {
                title,
                content,
                imageUrl: imageUrl || '/placeholder.svg',
                type: type || 'ARTICLE',
                userId: req.user.userId,
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
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'CREATE_PUBLICATION',
                module: 'PUBLICATIONS',
                details: `Publication ${publication.id} créée`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.status(201).json(publication);
    }
    catch (error) {
        console.error('Erreur lors de la création de la publication:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.get('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const publication = await auth_1.prisma.publication.findUnique({
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
        if (!publication) {
            return res.status(404).json({ error: 'Publication non trouvée' });
        }
        res.json(publication);
    }
    catch (error) {
        console.error('Erreur lors de la récupération de la publication:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.put('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const { title, content, imageUrl, status, motifRefus } = updatePublicationSchema.parse(req.body);
        const existingPublication = await auth_1.prisma.publication.findUnique({
            where: { id: req.params.id }
        });
        if (!existingPublication) {
            return res.status(404).json({ error: 'Publication non trouvée' });
        }
        const canModify = req.user.role === 'ADMIN' ||
            req.user.role === 'COMMUNICATION' ||
            existingPublication.userId === req.user.userId;
        if (!canModify) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const updateData = {};
        if (title)
            updateData.title = title;
        if (content)
            updateData.content = content;
        if (imageUrl)
            updateData.imageUrl = imageUrl;
        if (status)
            updateData.status = status;
        if (motifRefus)
            updateData.motifRefus = motifRefus;
        const publication = await auth_1.prisma.publication.update({
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
                action: 'UPDATE_PUBLICATION',
                module: 'PUBLICATIONS',
                details: `Publication ${publication.id} mise à jour - Statut: ${status || 'modifié'}`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json(publication);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour de la publication:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.delete('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const existingPublication = await auth_1.prisma.publication.findUnique({
            where: { id: req.params.id }
        });
        if (!existingPublication) {
            return res.status(404).json({ error: 'Publication non trouvée' });
        }
        const canDelete = req.user.role === 'ADMIN' || existingPublication.userId === req.user.userId;
        if (!canDelete) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        await auth_1.prisma.publication.delete({
            where: { id: req.params.id }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'DELETE_PUBLICATION',
                module: 'PUBLICATIONS',
                details: `Publication ${req.params.id} supprimée`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Erreur lors de la suppression de la publication:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.default = router;
//# sourceMappingURL=publications.js.map