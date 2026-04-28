"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const demandes_1 = __importDefault(require("./routes/demandes"));
const finances_1 = __importDefault(require("./routes/finances"));
const publications_1 = __importDefault(require("./routes/publications"));
const partenaires_1 = __importDefault(require("./routes/partenaires"));
const visites_1 = __importDefault(require("./routes/visites"));
const users_1 = __importDefault(require("./routes/users"));
const logs_1 = __importDefault(require("./routes/logs"));
const comments_1 = __importDefault(require("./routes/comments"));
const projects_1 = __importDefault(require("./routes/projects"));
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
const runtimeEnv = process.env.NODE_ENV || 'development';
const envPath = `.env.${runtimeEnv}`;
const envResult = dotenv_1.default.config({ path: envPath });
if (envResult.error) {
    dotenv_1.default.config();
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const allowedOrigins = new Set([
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://actionhub.globalsos.org',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004'
]);
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Origine non autorisée par CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
app.use(requestLogger_1.requestLogger);
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/demandes', demandes_1.default);
app.use('/api/finances', finances_1.default);
app.use('/api/publications', publications_1.default);
app.use('/api/partenaires', partenaires_1.default);
app.use('/api/visites', visites_1.default);
app.use('/api/users', users_1.default);
app.use('/api/logs', logs_1.default);
app.use('/api/comments', comments_1.default);
app.use('/api/projects', projects_1.default);
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method
    });
});
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`🚀 Serveur backend démarré sur le port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});
exports.default = app;
//# sourceMappingURL=server.js.map