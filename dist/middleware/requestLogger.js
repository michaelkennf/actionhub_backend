"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
function requestLogger(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logMessage = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
        if (res.statusCode >= 400) {
            console.error(`❌ ${logMessage}`);
        }
        else {
            console.log(`✅ ${logMessage}`);
        }
    });
    next();
}
//# sourceMappingURL=requestLogger.js.map