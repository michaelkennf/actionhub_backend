import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/auth'
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

async function canViewProject(projectId: string, user: NonNullable<AuthenticatedRequest['user']>) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, coordinatorId: true, mealId: true }
  })

  if (!project) return { allowed: false, exists: false }
  if (user.role === 'ADMIN') return { allowed: true, exists: true }
  if (user.role === 'MEAL') return { allowed: project.mealId === user.userId, exists: true }
  if (user.role === 'COORDINATOR') return { allowed: project.coordinatorId === user.userId, exists: true }
  return { allowed: false, exists: true }
}

async function canEditProject(projectId: string, user: NonNullable<AuthenticatedRequest['user']>) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, mealId: true }
  })

  if (!project) return { allowed: false, exists: false }
  if (user.role === 'ADMIN') return { allowed: true, exists: true }
  if (user.role === 'MEAL') return { allowed: project.mealId === user.userId, exists: true }
  return { allowed: false, exists: true }
}

const createProjectSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  location: z.string().optional(),
  description: z.string().optional(),
  budget: z.number().nonnegative().default(0),
  baseline: z.number().nonnegative().default(0),
  target: z.number().positive('La cible doit etre positive'),
  indicatorDataType: z.enum(['QUANTITATIVE', 'QUALITATIVE']).default('QUANTITATIVE'),
  kpiPrimaryColor: z.string().optional(),
  kpiSecondaryColor: z.string().optional(),
  kpiTertiaryColor: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  coordinatorId: z.string().optional(),
})

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  budget: z.number().nonnegative().optional(),
  baseline: z.number().nonnegative().optional(),
  target: z.number().nonnegative().optional(),
  current: z.number().nonnegative().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
  indicatorDataType: z.enum(['QUANTITATIVE', 'QUALITATIVE']).optional(),
  kpiPrimaryColor: z.string().optional(),
  kpiSecondaryColor: z.string().optional(),
  kpiTertiaryColor: z.string().optional(),
})

const createOutputSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  baseline: z.number().nonnegative().default(0),
  target: z.number().positive('La cible doit etre positive'),
  current: z.number().nonnegative().default(0),
  unit: z.string().optional(),
})

const createIndicatorSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  baseline: z.number().nonnegative().default(0),
  target: z.number().positive('La cible doit etre positive'),
  value: z.number().nonnegative(),
  unit: z.string().optional(),
  dataType: z.enum(['QUANTITATIVE', 'QUALITATIVE']).optional(),
  showAsKpi: z.boolean().optional(),
  measurementDate: z.string().datetime().optional(),
})

const createOutcomeSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  baseline: z.number().nonnegative().default(0),
  target: z.number().positive('La cible doit etre positive'),
  value: z.number().nonnegative(),
  unit: z.string().optional(),
  measurementDate: z.string().datetime().optional(),
})

router.get('/', authenticateToken, requireRole(['COORDINATOR', 'MEAL', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, search, startDate, endDate } = req.query
    const where: Prisma.ProjectWhereInput = {}

    if (status) where.status = status
    if (search) {
      where.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ]
    }
    if (startDate || endDate) {
      where.startDate = {}
      if (startDate) where.startDate.gte = new Date(String(startDate))
      if (endDate) where.startDate.lte = new Date(String(endDate))
    }

    if (req.user!.role === 'MEAL') where.mealId = req.user!.userId
    if (req.user!.role === 'COORDINATOR') where.coordinatorId = req.user!.userId

    const projects = await prisma.project.findMany({
      where,
      include: {
        outputs: {
          include: {
            indicators: {
              orderBy: { measurementDate: 'asc' }
            }
          }
        },
        outcomes: {
          orderBy: { measurementDate: 'asc' }
        },
        coordinator: { select: { id: true, name: true, email: true } },
        meal: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ projects })
  } catch (error) {
    console.error('Erreur lors de la recuperation des projets:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.post('/', authenticateToken, requireRole(['MEAL', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const data = createProjectSchema.parse(req.body)

    const project = await prisma.project.create({
      data: {
        title: data.title,
        location: data.location,
        description: data.description,
        budget: data.budget,
        baseline: data.baseline,
        target: data.target,
        indicatorDataType: data.indicatorDataType,
        kpiPrimaryColor: data.kpiPrimaryColor || '#2563eb',
        kpiSecondaryColor: data.kpiSecondaryColor || '#9333ea',
        kpiTertiaryColor: data.kpiTertiaryColor || '#16a34a',
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        coordinatorId: data.coordinatorId || null,
        mealId: req.user!.userId,
      }
    })

    res.status(201).json(project)
  } catch (error) {
    console.error('Erreur lors de la creation du projet:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.post('/:projectId/outputs', authenticateToken, requireRole(['MEAL', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params
    const permission = await canEditProject(projectId, req.user!)
    if (!permission.exists) {
      return res.status(404).json({ error: 'Projet non trouve' })
    }
    if (!permission.allowed) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const data = createOutputSchema.parse(req.body)

    const output = await prisma.projectOutput.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
        baseline: data.baseline,
        target: data.target,
        current: data.current,
        unit: data.unit,
      }
    })

    res.status(201).json(output)
  } catch (error) {
    console.error('Erreur lors de la creation de output:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.get('/:projectId', authenticateToken, requireRole(['COORDINATOR', 'MEAL', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params
    const permission = await canViewProject(projectId, req.user!)
    if (!permission.exists) return res.status(404).json({ error: 'Projet non trouve' })
    if (!permission.allowed) return res.status(403).json({ error: 'Permissions insuffisantes' })

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        outputs: { include: { indicators: { orderBy: { measurementDate: 'desc' } } } },
        outcomes: { orderBy: { measurementDate: 'desc' } },
        coordinator: { select: { id: true, name: true, email: true } },
        meal: { select: { id: true, name: true, email: true } },
      }
    })

    if (!project) return res.status(404).json({ error: 'Projet non trouve' })
    res.json(project)
  } catch (error) {
    console.error('Erreur lors de la recuperation du projet:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.put('/:projectId', authenticateToken, requireRole(['MEAL', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params
    const permission = await canEditProject(projectId, req.user!)
    if (!permission.exists) return res.status(404).json({ error: 'Projet non trouve' })
    if (!permission.allowed) return res.status(403).json({ error: 'Permissions insuffisantes' })

    const data = updateProjectSchema.parse(req.body)

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate === null ? null : data.endDate ? new Date(data.endDate) : undefined,
      }
    })

    res.json(updated)
  } catch (error) {
    console.error('Erreur lors de la mise a jour du projet:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.delete('/:projectId', authenticateToken, requireRole(['MEAL', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params
    const permission = await canEditProject(projectId, req.user!)
    if (!permission.exists) return res.status(404).json({ error: 'Projet non trouve' })
    if (!permission.allowed) return res.status(403).json({ error: 'Permissions insuffisantes' })

    await prisma.project.delete({ where: { id: projectId } })
    res.json({ success: true })
  } catch (error) {
    console.error('Erreur lors de la suppression du projet:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.post('/outputs/:outputId/indicators', authenticateToken, requireRole(['MEAL', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { outputId } = req.params
    const output = await prisma.projectOutput.findUnique({
      where: { id: outputId },
      select: { projectId: true }
    })
    if (!output) {
      return res.status(404).json({ error: 'Output non trouve' })
    }
    const permission = await canEditProject(output.projectId, req.user!)
    if (!permission.allowed) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const data = createIndicatorSchema.parse(req.body)
    const parentProject = await prisma.project.findUnique({
      where: { id: output.projectId },
      select: { indicatorDataType: true }
    })

    const indicator = await prisma.outputIndicator.create({
      data: {
        outputId,
        name: data.name,
        baseline: data.baseline,
        target: data.target,
        value: data.value,
        unit: data.unit,
        dataType: data.dataType || parentProject?.indicatorDataType || 'QUANTITATIVE',
        showAsKpi: data.showAsKpi ?? true,
        measurementDate: data.measurementDate ? new Date(data.measurementDate) : new Date(),
      }
    })

    await prisma.projectOutput.update({
      where: { id: outputId },
      data: { current: data.value }
    })

    res.status(201).json(indicator)
  } catch (error) {
    console.error('Erreur lors de la creation de indicateur:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.post('/:projectId/outcomes', authenticateToken, requireRole(['MEAL', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params
    const permission = await canEditProject(projectId, req.user!)
    if (!permission.exists) {
      return res.status(404).json({ error: 'Projet non trouve' })
    }
    if (!permission.allowed) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const data = createOutcomeSchema.parse(req.body)

    const outcome = await prisma.projectOutcome.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
        baseline: data.baseline,
        target: data.target,
        value: data.value,
        unit: data.unit,
        measurementDate: data.measurementDate ? new Date(data.measurementDate) : new Date(),
      }
    })

    res.status(201).json(outcome)
  } catch (error) {
    console.error('Erreur lors de la creation de outcome:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.errors })
    }
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.get('/:projectId/evolution', authenticateToken, requireRole(['COORDINATOR', 'MEAL', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params
    const permission = await canViewProject(projectId, req.user!)
    if (!permission.exists) {
      return res.status(404).json({ error: 'Projet non trouve' })
    }
    if (!permission.allowed) {
      return res.status(403).json({ error: 'Permissions insuffisantes' })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        outputs: { include: { indicators: true } },
        outcomes: true
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Projet non trouve' })
    }

    const points: Record<string, { date: string; outputValue: number; outcomeValue: number }> = {}

    for (const output of project.outputs) {
      for (const indicator of output.indicators) {
        const dateKey = indicator.measurementDate.toISOString().slice(0, 10)
        if (!points[dateKey]) points[dateKey] = { date: dateKey, outputValue: 0, outcomeValue: 0 }
        points[dateKey].outputValue += indicator.value
      }
    }

    for (const outcome of project.outcomes) {
      const dateKey = outcome.measurementDate.toISOString().slice(0, 10)
      if (!points[dateKey]) points[dateKey] = { date: dateKey, outputValue: 0, outcomeValue: 0 }
      points[dateKey].outcomeValue += outcome.value
    }

    const evolution = Object.values(points).sort((a, b) => a.date.localeCompare(b.date))

    const outputTarget = project.outputs.reduce((sum, item) => sum + item.target, 0)
    const outputCurrent = project.outputs.reduce((sum, item) => sum + item.current, 0)
    const outputProgress = outputTarget > 0 ? Math.min(100, (outputCurrent / outputTarget) * 100) : 0

    const outcomeTarget = project.outcomes.reduce((sum, item) => sum + item.target, 0)
    const outcomeCurrent = project.outcomes.reduce((sum, item) => sum + item.value, 0)
    const outcomeProgress = outcomeTarget > 0 ? Math.min(100, (outcomeCurrent / outcomeTarget) * 100) : 0

    const globalProgress = (outputProgress + outcomeProgress) / 2

    const now = new Date()
    const startMs = project.startDate.getTime()
    const endMs = project.endDate ? project.endDate.getTime() : null
    const hasValidTimeline = endMs !== null && endMs > startMs
    const elapsedRatio = hasValidTimeline
      ? Math.min(1, Math.max(0, (now.getTime() - startMs) / (endMs - startMs)))
      : null
    const expectedProgress = elapsedRatio === null ? null : elapsedRatio * 100

    let status: 'EN_RETARD' | 'EN_PROGRESSION' | 'SUCCES' = 'EN_PROGRESSION'

    if (globalProgress >= 100) {
      status = 'SUCCES'
    } else if (project.endDate && now > project.endDate && globalProgress < 100) {
      status = 'EN_RETARD'
    } else if (expectedProgress !== null && globalProgress + 15 < expectedProgress) {
      status = 'EN_RETARD'
    } else if ((expectedProgress !== null && globalProgress >= expectedProgress + 10) || globalProgress >= 75) {
      status = 'SUCCES'
    }

    const statusColor = status === 'EN_RETARD'
      ? project.kpiPrimaryColor
      : status === 'EN_PROGRESSION'
        ? project.kpiSecondaryColor
        : project.kpiTertiaryColor
    const indicatorKpis = project.outputs.flatMap((output) =>
      output.indicators
        .filter((indicator) => indicator.showAsKpi)
        .map((indicator) => {
          const progress = indicator.target > 0 ? Math.min(100, (indicator.value / indicator.target) * 100) : 0
          return {
            id: indicator.id,
            outputId: output.id,
            outputName: output.name,
            name: indicator.name,
            dataType: indicator.dataType,
            value: indicator.value,
            target: indicator.target,
            baseline: indicator.baseline,
            unit: indicator.unit,
            progress,
            color: statusColor,
          }
        })
    )

    res.json({
      project: {
        id: project.id,
        title: project.title,
        baseline: project.baseline,
        target: project.target,
        indicatorDataType: project.indicatorDataType,
        kpiPrimaryColor: project.kpiPrimaryColor,
        kpiSecondaryColor: project.kpiSecondaryColor,
        kpiTertiaryColor: project.kpiTertiaryColor,
      },
      summary: {
        outputProgress,
        outcomeProgress,
        globalProgress,
        expectedProgress,
        status,
        statusColor,
        outputCurrent,
        outputTarget,
        outcomeCurrent,
        outcomeTarget,
      },
      indicatorKpis,
      evolution,
    })
  } catch (error) {
    console.error('Erreur lors de la recuperation de evolution:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
