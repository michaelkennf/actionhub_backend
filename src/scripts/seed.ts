import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

async function main() {
  console.log('🌱 Initialisation de la base de données...\n')

  // Créer les utilisateurs de test
  const users = [
    {
      email: 'coordinateur@globalsos.org',
      password: 'password123',
      name: 'Marie Dubois',
      role: 'COORDINATOR' as const,
    },
    {
      email: 'finance@globalsos.org',
      password: 'password123',
      name: 'Jean Martin',
      role: 'FINANCE' as const,
    },
    {
      email: 'communication@globalsos.org',
      password: 'password123',
      name: 'Sophie Laurent',
      role: 'COMMUNICATION' as const,
    },
    {
      email: 'logistique@globalsos.org',
      password: 'password123',
      name: 'Pierre Durand',
      role: 'LOGISTICS' as const,
    },
    {
      email: 'admin@globalsos.org',
      password: 'password123',
      name: 'Admin Système',
      role: 'ADMIN' as const,
    },
    {
      email: 'meal@globalsos.org',
      password: 'password123',
      name: 'Aline Kanku',
      role: 'MEAL' as const,
    },
  ]

  for (const userData of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email }
    })

    if (!existingUser) {
      const hashedPassword = await hashPassword(userData.password)
      
      await prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          name: userData.name,
          role: userData.role,
          active: true
        }
      })
      
      console.log(`✅ Utilisateur créé: ${userData.email} (${userData.role})`)
    } else {
      console.log(`ℹ️  Utilisateur existe déjà: ${userData.email}`)
    }
  }

  console.log('\n✅ Initialisation terminée avec succès!')
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors de l\'initialisation:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
