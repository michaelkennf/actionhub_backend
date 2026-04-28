"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function hashPassword(password) {
    return await bcryptjs_1.default.hash(password, 12);
}
async function main() {
    console.log('🌱 Initialisation de la base de données...\n');
    const users = [
        {
            email: 'coordinateur@globalsos.org',
            password: 'password123',
            name: 'Marie Dubois',
            role: 'COORDINATOR',
        },
        {
            email: 'finance@globalsos.org',
            password: 'password123',
            name: 'Jean Martin',
            role: 'FINANCE',
        },
        {
            email: 'communication@globalsos.org',
            password: 'password123',
            name: 'Sophie Laurent',
            role: 'COMMUNICATION',
        },
        {
            email: 'logistique@globalsos.org',
            password: 'password123',
            name: 'Pierre Durand',
            role: 'LOGISTICS',
        },
        {
            email: 'admin@globalsos.org',
            password: 'password123',
            name: 'Admin Système',
            role: 'ADMIN',
        },
        {
            email: 'meal@globalsos.org',
            password: 'password123',
            name: 'Aline Kanku',
            role: 'MEAL',
        },
    ];
    for (const userData of users) {
        const existingUser = await prisma.user.findUnique({
            where: { email: userData.email }
        });
        if (!existingUser) {
            const hashedPassword = await hashPassword(userData.password);
            await prisma.user.create({
                data: {
                    email: userData.email,
                    password: hashedPassword,
                    name: userData.name,
                    role: userData.role,
                    active: true
                }
            });
            console.log(`✅ Utilisateur créé: ${userData.email} (${userData.role})`);
        }
        else {
            console.log(`ℹ️  Utilisateur existe déjà: ${userData.email}`);
        }
    }
    console.log('\n✅ Initialisation terminée avec succès!');
}
main()
    .catch((e) => {
    console.error('❌ Erreur lors de l\'initialisation:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map