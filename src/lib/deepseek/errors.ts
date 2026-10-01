import { t } from '@/i18n';

export type DeepSeekErrorKind =
  | 'missing_key'
  | 'auth'
  | 'balance'
  | 'rate_limit'
  | 'overloaded'
  | 'server'
  | 'bad_request'
  | 'network'
  | 'aborted'
  | 'invalid_response'
  | 'unknown';

export class DeepSeekError extends Error {
  readonly kind: DeepSeekErrorKind;
  readonly status?: number;
  /** Raw message from the API, if any. */
  readonly apiMessage?: string;

  constructor(kind: DeepSeekErrorKind, message: string, opts: { status?: number; apiMessage?: string } = {}) {
    super(message);
    this.name = 'DeepSeekError';
    this.kind = kind;
    this.status = opts.status;
    this.apiMessage = opts.apiMessage;
  }

  get retryable(): boolean {
    return ['rate_limit', 'overloaded', 'server', 'network'].includes(this.kind);
  }
}

/** Maps a DeepSeek HTTP error (https://api-docs.deepseek.com/quick_start/error_codes) to a friendly error. */
export function errorFromResponse(status: number, apiMessage: string | undefined): DeepSeekError {
  const detail = apiMessage?.trim();
  const opts = { status, apiMessage: detail };
  switch (status) {
    case 400:
    case 422:
      return new DeepSeekError(
        'bad_request',
        detail ? t('error.badRequestDetail', { detail }) : t('error.badRequest'),
        opts,
      );
    case 401:
      return new DeepSeekError('auth', t('error.auth'), opts);
    case 402:
      return new DeepSeekError(
        'balance',
        t('error.balance'),
        opts,
      );
    case 429:
      return new DeepSeekError('rate_limit', t('error.rateLimit'), opts);
    case 503:
      return new DeepSeekError('overloaded', t('error.overloaded'), opts);
    default:
      if (status >= 500) {
        return new DeepSeekError('server', t('error.server'), opts);
      }
      return new DeepSeekError(
        'unknown',
        detail ? t('error.unknownDetail', { status, detail }) : t('error.unknown', { status }),
        opts,
      );
  }
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DeepSeekError) return error.kind === 'aborted';
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    ((error as { name: string }).name === 'AbortError' || (error as { name: string }).name === 'CanceledError')
  );
}

export function toDeepSeekError(error: unknown): DeepSeekError {
  if (error instanceof DeepSeekError) return error;
  if (isAbortError(error)) return new DeepSeekError('aborted', t('transcript.stopped'));
  const message = error instanceof Error ? error.message : String(error);
  return new DeepSeekError('network', t('error.network', { message }));
}
