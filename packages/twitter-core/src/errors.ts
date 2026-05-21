export class TwitterError extends Error {
  readonly errorCode: string;

  constructor(message: string, errorCode = "api_error") {
    super(message);
    this.name = new.target.name;
    this.errorCode = errorCode;
  }
}

export class AuthenticationError extends TwitterError {
  constructor(message: string) {
    super(message, "not_authenticated");
  }
}

export class RateLimitError extends TwitterError {
  constructor(message: string) {
    super(message, "rate_limited");
  }
}

export class NotFoundError extends TwitterError {
  constructor(message: string) {
    super(message, "not_found");
  }
}

export class NetworkError extends TwitterError {
  constructor(message: string) {
    super(message, "network_error");
  }
}

export class QueryIdError extends TwitterError {
  constructor(message: string) {
    super(message, "query_id_error");
  }
}

export class InvalidInputError extends TwitterError {
  constructor(message: string) {
    super(message, "invalid_input");
  }
}

export class TwitterApiError extends TwitterError {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    const errorCode =
      statusCode === 401 || statusCode === 403
        ? "not_authenticated"
        : statusCode === 429
          ? "rate_limited"
          : statusCode === 404
            ? "not_found"
            : "api_error";
    super(`Twitter API error (HTTP ${statusCode}): ${message}`, errorCode);
    this.statusCode = statusCode;
  }
}
