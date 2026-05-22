// A typed, HTTP-aware error. Anything thrown that is not an AppError is
// treated as a 500 by the global error handler.
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (message = "Bad request", details?: unknown) =>
    new AppError(400, "bad_request", message, details),
  unauthorized: (message = "Authentication required") =>
    new AppError(401, "unauthorized", message),
  forbidden: (message = "You do not have permission to do that") =>
    new AppError(403, "forbidden", message),
  notFound: (message = "Resource not found") =>
    new AppError(404, "not_found", message),
  conflict: (message = "Resource already exists") =>
    new AppError(409, "conflict", message),
  tooMany: (message = "Too many requests") =>
    new AppError(429, "rate_limited", message),
  tenantNotFound: () =>
    new AppError(
      404,
      "tenant_not_found",
      "No wedding is configured for this domain",
    ),
  vaultExpired: () =>
    new AppError(
      403,
      "vault_expired",
      "This wedding vault has expired. Renew to keep streaming.",
    ),
};
