"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    console.error('Erreur:', err);
    if (err.code === 'P2002') {
        return res.status(400).json({
            error: 'Violation de contrainte unique',
            details: 'Cette valeur existe déjà'
        });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({
            error: 'Enregistrement non trouvé'
        });
    }
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
        return res.status(400).json({
            error: 'Format JSON invalide'
        });
    }
    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: 'Données invalides',
            details: err.errors
        });
    }
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Erreur serveur interne';
    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}
//# sourceMappingURL=errorHandler.js.map