/**
 * Base error type for schema and registry related failures.
 *
 * @extends Error
 */
export class BridgeSchemaError extends Error {
  /**
   * @param message - Concise explanation of what went wrong.
   * @param options - Native error options forwarded to the base {@link Error} class.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BridgeSchemaError';
  }
}

/**
 * Thrown when data does not satisfy the declared schema for an event.
 */
export class BridgeValidationError extends BridgeSchemaError {
  public readonly details?: unknown;

  /**
   * @param message - Summarised validation failure.
   * @param options - Native error options alongside optional structured details (e.g. Zod issues).
   */
  constructor(message: string, options?: ErrorOptions & { details?: unknown }) {
    super(message, options);
    this.name = 'BridgeValidationError';
    this.details = options?.details;
  }
}
