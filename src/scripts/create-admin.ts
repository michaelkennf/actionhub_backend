import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

async function main() {
  console.log('👤 Création d\'un utilisateur admin...\n')

  const args = process.argv.slice(2)
  
  if (args.length < 3) {
    console.log('❌ Usage: npm run create-admin <email> <nom> <password>')
    console.log('Exemple: npm run create-admin admin@globalsos.org "Admin GlobalSOS" password123')
    process.exit(1)
  }

  const [email, nom, password] = args

  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      console.log(`❌ Un utilisateur avec l'email ${email} existe déjà.`)
      process.exit(1)
    }

    // Hacher le mot de passe
    const hashedPassword = await hashPassword(password)

    // Créer l'utilisateur admin
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: nom,
        role: 'ADMIN',
        active: true
      }
    })

    console.log('✅ Utilisateur admin créé avec succès!')
    console.log('\n📋 Informations de connexion:')
    console.log(`   Email: ${email}`)
    console.log(`   Nom: ${nom}`)
    console.log(`   Rôle: ADMIN`)
    console.log(`   ID: ${user.id}`)
    console.log('\n💡 Vous pouvez maintenant vous connecter avec cet utilisateur.')

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

