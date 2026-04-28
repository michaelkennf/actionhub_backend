"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.createToken = createToken;
exports.verifyToken = verifyToken;
exports.getSession = getSession;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined in environment variables');
}
async function hashPassword(password) {
    return await bcryptjs_1.default.hash(password, 12);
}
async function verifyPassword(password, hashedPassword) {
    return await bcryptjs_1.default.compare(password, hashedPassword);
}
async function createToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: '7d',
        issuer: 'globalsos-api',
        audience: 'globalsos-frontend'
    });
}
async function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        return null;
    }
}
async function getSession(req) {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token)
        return null;
    const payload = await verifyToken(token);
    if (!payload)
        return null;
    try {
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                active: true
            }
        });
        if (!user || !user.active) {
            return null;
        }
        return {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        };
    }
    catch (error) {
        console.error('Erreur lors de la vérification de session:', error);
        return null;
    }
}
//# sourceMappingURL=auth.js.map