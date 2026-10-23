export class AgyError extends Error {
  constructor(message, { suggestion = null, cause = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.suggestion = suggestion;
    if (cause != null) this.cause = cause;
  }
}

export class AgyConnectionError extends AgyError {}
export class AgyAuthError extends AgyError {}
export class AgyTimeoutError extends AgyError {}
export class AgyModelError extends AgyError {}
export class AgyContentFilterError extends AgyError {}
export class AgyQuotaError extends AgyError {}
export class AgyInterruptedError extends AgyError {}

export class PluginError extends Error {
  constructor(message, { suggestion = null, cause = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.suggestion = suggestion;
    if (cause != null) this.cause = cause;
  }
}

export class GitError extends PluginError {}
export class ReviewOutputError extends PluginError {}
export class ConfigError extends PluginError {}
// The run worked, but its answer is not what the ask needs: JSON that fits --schema, an image for --image-out, or any text.
export class OutputError extends PluginError {}
