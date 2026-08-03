export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (m: string, code?: string, d?: unknown) =>
  new AppError(400, m, code, d);
export const unauthorized = (m = 'Sign in to continue') => new AppError(401, m);
export const forbidden = (m = 'You do not have access to this') => new AppError(403, m);
export const notFound = (m = 'Not found') => new AppError(404, m);
export const conflict = (m: string, code?: string) => new AppError(409, m, code);
