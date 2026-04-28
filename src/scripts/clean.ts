import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Nettoyage de la base de données...\n')

  try {
    // Supprimer toutes les données dans l'ordre des dépendances

    // 1. Supprimer les logs
    const logsDeleted = await prisma.log.deleteMany({})
    console.log(`🗑️  ${logsDeleted.count} logs supprimés`)

    // 2. Supprimer les commentaires
    const commentsDeleted = await prisma.comment.deleteMany({})
    console.log(`🗑️  ${commentsDeleted.count} commentaires supprimés`)

    // 3. Supprimer les transactions
    const transactionsDeleted = await prisma.transaction.deleteMany({})
    console.log(`🗑️  ${transactionsDeleted.count} transactions supprimées`)

    // 4. Supprimer les visites
    const visitesDeleted = await prisma.visite.deleteMany({})
    console.log(`🗑️  ${visitesDeleted.count} visites supprimées`)

    // 5. Supprimer les rapports
    const rapportsDeleted = await prisma.rapport.deleteMany({})
    console.log(`🗑️  ${rapportsDeleted.count} rapports supprimés`)

    // 6. Supprimer les partenaires
    const partenairesDeleted = await prisma.partenaire.deleteMany({})
    console.log(`🗑️  ${partenairesDeleted.count} partenaires supprimés`)

    // 7. Supprimer les publications
    const publicationsDeleted = await prisma.publication.deleteMany({})
    console.log(`🗑️  ${publicationsDeleted.count} publications supprimées`)

    // 8. Supprimer les documents
    const documentsDeleted = await prisma.document.deleteMany({})
    console.log(`🗑️  ${documentsDeleted.count} documents supprimés`)

    // 9. Supprimer les demandes
    const demandesDeleted = await prisma.demande.deleteMany({})
    console.log(`🗑️  ${demandesDeleted.count} demandes supprimées`)

    // 10. Supprimer les utilisateurs
    const usersDeleted = await prisma.user.deleteMany({})
    console.log(`🗑️  ${usersDeleted.count} utilisateurs supprimés`)

    console.log('\n✅ Base de données nettoyée avec succès!')
    console.log('📝 Toutes les données ont été supprimées.')
    console.log('💡 La structure des tables est conservée.')

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du nettoyage:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

