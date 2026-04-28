"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
exports.requireAdmin = requireAdmin;
exports.requireFinance = requireFinance;
exports.requireCommunication = requireCommunication;
exports.requireCoordinator = requireCoordinator;
exports.requireLogistics = requireLogistics;
exports.requireMeal = requireMeal;
const auth_1 = require("../lib/auth");
async function authenticateToken(req, res, next) {
    try {
        const session = await (0, auth_1.getSession)(req);
        if (!session) {
            return res.status(401).json({ error: 'Non autorisé' });
        }
        req.user = session;
        next();
    }
    catch (error) {
        console.error('Erreur d\'authentification:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
}
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Permissions insuffisantes' });
        }
        next();
    };
}
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
}
function requireFinance(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!['FINANCE', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
}
function requireCommunication(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!['COMMUNICATION', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
}
function requireCoordinator(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!['COORDINATOR', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
}
function requireLogistics(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!['LOGISTICS', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
}
function requireMeal(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!['MEAL', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
}
//# sourceMappingURL=auth.js.map