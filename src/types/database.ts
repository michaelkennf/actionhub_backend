import { Prisma } from '@prisma/client'

// Types pour les clauses where
export interface DemandeWhereInput {
  status?: string
  type?: string
  userId?: string
}

export interface VisiteWhereInput {
  status?: string
  type?: string
  userId?: string
  heureArrivee?: {
    gte: Date
    lte: Date
  }
}

export interface PublicationWhereInput {
  status?: string
  type?: string
  userId?: string
}

export interface PartenaireWhereInput {
  active?: boolean
  type?: string
  domaine?: {
    contains: string
    mode: 'insensitive'
  }
}

export interface UserWhereInput {
  role?: string
  active?: boolean
}

export interface CommentWhereInput {
  demandeId?: string
  documentId?: string
  publicationId?: string
}

export interface LogWhereInput {
  module?: string
  action?: string
  userId?: string
  createdAt?: {
    gte: Date
    lte: Date
  }
}

// Types pour les updates
export interface DemandeUpdateData {
  status?: string
  motifRefus?: string
  description?: string
  items?: unknown
  totalAmount?: number
}

export interface PublicationUpdateData {
  status?: string
  motifRefus?: string
}

export interface UserUpdateData {
  email?: string
  password?: string
  name?: string
  role?: string
  active?: boolean
}

