export class AppError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export function publicError(error: unknown, fallback: string): AppError {
  if (error instanceof AppError) return error;
  return new AppError(fallback, 500);
}
