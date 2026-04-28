"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const createCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'Contenu requis'),
    demandeId: zod_1.z.string().optional(),
    documentId: zod_1.z.string().optional(),
    publicationId: zod_1.z.string().optional()
});
const updateCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'Contenu requis')
});
router.get('/', auth_2.authenticateToken, async (req, res) => {
    try {
        const { demandeId, documentId, publicationId, page = '1', limit = '50' } = req.query;
        const where = {};
        if (demandeId)
            where.demandeId = demandeId;
        if (documentId)
            where.documentId = documentId;
        if (publicationId)
            where.publicationId = publicationId;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [comments, total] = await Promise.all([
            auth_1.prisma.comment.findMany({
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
                take: parseInt(limit)
            }),
            auth_1.prisma.comment.count({ where })
        ]);
        res.json({
            comments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Erreur lors de la récupération des commentaires:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.post('/', auth_2.authenticateToken, async (req, res) => {
    try {
        const { content, demandeId, documentId, publicationId } = createCommentSchema.parse(req.body);
        if (!demandeId && !documentId && !publicationId) {
            return res.status(400).json({ error: 'Une entité doit être spécifiée' });
        }
        const comment = await auth_1.prisma.comment.create({
            data: {
                content,
                userId: req.user.userId,
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
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'CREATE_COMMENT',
                module: 'COMMENTS',
                details: `Commentaire ${comment.id} créé`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.status(201).json(comment);
    }
    catch (error) {
        console.error('Erreur lors de la création du commentaire:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.get('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const comment = await auth_1.prisma.comment.findUnique({
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
        if (!comment) {
            return res.status(404).json({ error: 'Commentaire non trouvé' });
        }
        res.json(comment);
    }
    catch (error) {
        console.error('Erreur lors de la récupération du commentaire:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.put('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const { content } = updateCommentSchema.parse(req.body);
        const existingComment = await auth_1.prisma.comment.findUnique({
            where: { id: req.params.id }
        });
        if (!existingComment) {
            return res.status(404).json({ error: 'Commentaire non trouvé' });
        }
        if (existingComment.userId !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const comment = await auth_1.prisma.comment.update({
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
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'UPDATE_COMMENT',
                module: 'COMMENTS',
                details: `Commentaire ${comment.id} mis à jour`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json(comment);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour du commentaire:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.delete('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const existingComment = await auth_1.prisma.comment.findUnique({
            where: { id: req.params.id }
        });
        if (!existingComment) {
            return res.status(404).json({ error: 'Commentaire non trouvé' });
        }
        if (existingComment.userId !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        await auth_1.prisma.comment.delete({
            where: { id: req.params.id }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'DELETE_COMMENT',
                module: 'COMMENTS',
                details: `Commentaire ${req.params.id} supprimé`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Erreur lors de la suppression du commentaire:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.default = router;
//# sourceMappingURL=comments.js.map