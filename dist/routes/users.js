"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalide'),
    password: zod_1.z.string().min(6, 'Mot de passe trop court'),
    name: zod_1.z.string().min(1, 'Nom requis'),
    role: zod_1.z.enum(['COORDINATOR', 'FINANCE', 'COMMUNICATION', 'LOGISTICS', 'MEAL', 'ADMIN'])
});
const updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().optional(),
    password: zod_1.z.string().min(6).optional(),
    name: zod_1.z.string().optional(),
    role: zod_1.z.enum(['COORDINATOR', 'FINANCE', 'COMMUNICATION', 'LOGISTICS', 'MEAL', 'ADMIN']).optional(),
    active: zod_1.z.boolean().optional()
});
router.get('/', auth_2.authenticateToken, auth_2.requireAdmin, async (req, res) => {
    try {
        const { role, active, page = '1', limit = '50' } = req.query;
        const where = {};
        if (role)
            where.role = role;
        if (active !== undefined)
            where.active = active === 'true';
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [users, total] = await Promise.all([
            auth_1.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    active: true,
                    createdAt: true,
                    updatedAt: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: parseInt(limit)
            }),
            auth_1.prisma.user.count({ where })
        ]);
        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.post('/', auth_2.authenticateToken, auth_2.requireAdmin, async (req, res) => {
    try {
        const { email, password, name, role } = createUserSchema.parse(req.body);
        const existingUser = await auth_1.prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        const hashedPassword = await (0, auth_1.hashPassword)(password);
        const user = await auth_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role,
                active: true
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
                createdAt: true
            }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'CREATE_USER',
                module: 'USERS',
                details: `Utilisateur ${user.id} créé: ${email}`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.status(201).json(user);
    }
    catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.get('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.userId !== req.params.id) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const user = await auth_1.prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.put('/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const { email, password, name, role, active } = updateUserSchema.parse(req.body);
        const existingUser = await auth_1.prisma.user.findUnique({
            where: { id: req.params.id }
        });
        if (!existingUser) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        const canModify = req.user.role === 'ADMIN' || req.user.userId === req.params.id;
        if (!canModify) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const updateData = {};
        if (email)
            updateData.email = email;
        if (password)
            updateData.password = await (0, auth_1.hashPassword)(password);
        if (name)
            updateData.name = name;
        if (req.user.role === 'ADMIN') {
            if (role)
                updateData.role = role;
            if (active !== undefined)
                updateData.active = active;
        }
        const user = await auth_1.prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true,
                updatedAt: true
            }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'UPDATE_USER',
                module: 'USERS',
                details: `Utilisateur ${user.id} mis à jour`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json(user);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.delete('/:id', auth_2.authenticateToken, auth_2.requireAdmin, async (req, res) => {
    try {
        if (req.user.userId === req.params.id) {
            return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
        }
        const existingUser = await auth_1.prisma.user.findUnique({
            where: { id: req.params.id }
        });
        if (!existingUser) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        await auth_1.prisma.user.delete({
            where: { id: req.params.id }
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'DELETE_USER',
                module: 'USERS',
                details: `Utilisateur ${req.params.id} supprimé`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map