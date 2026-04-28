import { Request, Response, NextFunction } from 'express'
import { getSession } from '../lib/auth'

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    email: string
    name: string
    role: string
  }
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const session = await getSession(req)
    
    if (!session) {
      return res.status(401).json({ error: 'Non autorisé' })
    }

    req.user = session
    next()
  } catch (error) {
    console.error('Erreur d\'authentification:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    next()
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Permissions insuffisantes' })
  }

  next()
}

export function requireFinance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  if (!['FINANCE', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permissions insuffisantes' })
  }

  next()
}

export function requireCommunication(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  if (!['COMMUNICATION', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permissions insuffisantes' })
  }

  next()
}

export function requireCoordinator(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  if (!['COORDINATOR', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permissions insuffisantes' })
  }

  next()
}

export function requireLogistics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  if (!['LOGISTICS', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permissions insuffisantes' })
  }

  next()
}

export function requireMeal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  if (!['MEAL', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permissions insuffisantes' })
  }

  next()
}
