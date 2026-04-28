import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        email: string;
        name: string;
        role: string;
    };
}
export declare function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
export declare function requireRole(roles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function requireFinance(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function requireCommunication(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function requireCoordinator(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function requireLogistics(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function requireMeal(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map