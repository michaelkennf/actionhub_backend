import { Request, Response, NextFunction } from 'express'

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Erreur:', err)

  // Erreur de validation Prisma
  if (err.code === 'P2002') {
    return res.status(400).json({
      error: 'Violation de contrainte unique',
      details: 'Cette valeur existe déjà'
    })
  }

  // Erreur de validation Prisma
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Enregistrement non trouvé'
    })
  }

  // Erreur de syntaxe JSON
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return res.status(400).json({
      error: 'Format JSON invalide'
    })
  }

  // Erreur de validation Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Données invalides',
      details: err.errors
    })
  }

  // Erreur par défaut
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Erreur serveur interne'

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}
