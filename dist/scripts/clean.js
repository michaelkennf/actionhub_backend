"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🧹 Nettoyage de la base de données...\n');
    try {
        const logsDeleted = await prisma.log.deleteMany({});
        console.log(`🗑️  ${logsDeleted.count} logs supprimés`);
        const commentsDeleted = await prisma.comment.deleteMany({});
        console.log(`🗑️  ${commentsDeleted.count} commentaires supprimés`);
        const transactionsDeleted = await prisma.transaction.deleteMany({});
        console.log(`🗑️  ${transactionsDeleted.count} transactions supprimées`);
        const visitesDeleted = await prisma.visite.deleteMany({});
        console.log(`🗑️  ${visitesDeleted.count} visites supprimées`);
        const rapportsDeleted = await prisma.rapport.deleteMany({});
        console.log(`🗑️  ${rapportsDeleted.count} rapports supprimés`);
        const partenairesDeleted = await prisma.partenaire.deleteMany({});
        console.log(`🗑️  ${partenairesDeleted.count} partenaires supprimés`);
        const publicationsDeleted = await prisma.publication.deleteMany({});
        console.log(`🗑️  ${publicationsDeleted.count} publications supprimées`);
        const documentsDeleted = await prisma.document.deleteMany({});
        console.log(`🗑️  ${documentsDeleted.count} documents supprimés`);
        const demandesDeleted = await prisma.demande.deleteMany({});
        console.log(`🗑️  ${demandesDeleted.count} demandes supprimées`);
        const usersDeleted = await prisma.user.deleteMany({});
        console.log(`🗑️  ${usersDeleted.count} utilisateurs supprimés`);
        console.log('\n✅ Base de données nettoyée avec succès!');
        console.log('📝 Toutes les données ont été supprimées.');
        console.log('💡 La structure des tables est conservée.');
    }
    catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
        throw error;
    }
}
main()
    .catch((e) => {
    console.error('❌ Erreur lors du nettoyage:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=clean.js.map