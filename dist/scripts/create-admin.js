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
    console.log('👤 Création d\'un utilisateur admin...\n');
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log('❌ Usage: npm run create-admin <email> <nom> <password>');
        console.log('Exemple: npm run create-admin admin@globalsos.org "Admin GlobalSOS" password123');
        process.exit(1);
    }
    const [email, nom, password] = args;
    try {
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            console.log(`❌ Un utilisateur avec l'email ${email} existe déjà.`);
            process.exit(1);
        }
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: nom,
                role: 'ADMIN',
                active: true
            }
        });
        console.log('✅ Utilisateur admin créé avec succès!');
        console.log('\n📋 Informations de connexion:');
        console.log(`   Email: ${email}`);
        console.log(`   Nom: ${nom}`);
        console.log(`   Rôle: ADMIN`);
        console.log(`   ID: ${user.id}`);
        console.log('\n💡 Vous pouvez maintenant vous connecter avec cet utilisateur.');
    }
    catch (error) {
        console.error('❌ Erreur lors de la création de l\'utilisateur:', error);
        process.exit(1);
    }
}
main()
    .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=create-admin.js.map