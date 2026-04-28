"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalide'),
    password: zod_1.z.string().min(1, 'Mot de passe requis')
});
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalide'),
    password: zod_1.z.string().min(6, 'Mot de passe trop court'),
    name: zod_1.z.string().min(1, 'Nom requis'),
    role: zod_1.z.enum(['COORDINATOR', 'FINANCE', 'COMMUNICATION', 'LOGISTICS', 'MEAL', 'ADMIN'])
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await auth_1.prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        if (!user.active) {
            return res.status(403).json({ error: 'Compte désactivé' });
        }
        const isValidPassword = await (0, auth_1.verifyPassword)(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        const token = await (0, auth_1.createToken)({
            userId: user.id,
            email: user.email,
            role: user.role
        });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        await auth_1.prisma.log.create({
            data: {
                action: 'LOGIN',
                module: 'AUTH',
                details: `Connexion réussie pour ${email}`,
                ipAddress: req.ip,
                userId: user.id
            }
        });
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('Erreur de connexion:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.post('/logout', auth_2.authenticateToken, async (req, res) => {
    try {
        res.clearCookie('token');
        await auth_1.prisma.log.create({
            data: {
                action: 'LOGOUT',
                module: 'AUTH',
                details: `Déconnexion de ${req.user?.email}`,
                ipAddress: req.ip,
                userId: req.user.userId
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Erreur de déconnexion:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.get('/me', auth_2.authenticateToken, async (req, res) => {
    try {
        res.json({
            user: {
                id: req.user.userId,
                email: req.user.email,
                name: req.user.name,
                role: req.user.role
            }
        });
    }
    catch (error) {
        console.error('Erreur lors de la récupération des informations utilisateur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
router.post('/register', auth_2.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        const { email, password, name, role } = registerSchema.parse(req.body);
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
                module: 'AUTH',
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
exports.default = router;
//# sourceMappingURL=auth.js.map