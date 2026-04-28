import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in environment variables')
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

interface JWTPayload {
  userId: string
  email: string
  role: string
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'globalsos-api',
    audience: 'globalsos-frontend'
  })
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

export async function getSession(req: any): Promise<JWTPayload | null> {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')

  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true
      }
    })

    if (!user || !user.active) {
      return null
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de session:', error)
    return null
  }
  // ⚠️ SUPPRIMÉ: await prisma.$disconnect() 
  // Le Prisma Client doit rester connecté pour les autres requêtes
  // Il gère automatiquement le pool de connexions
}

export { prisma }
