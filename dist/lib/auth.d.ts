import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, import(".prisma/client").Prisma.LogLevel, import("@prisma/client/runtime/library").DefaultArgs>;
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}
export declare function createToken(payload: JWTPayload): Promise<string>;
export declare function verifyToken(token: string): Promise<JWTPayload | null>;
export declare function getSession(req: any): Promise<JWTPayload | null>;
export { prisma };
//# sourceMappingURL=auth.d.ts.map