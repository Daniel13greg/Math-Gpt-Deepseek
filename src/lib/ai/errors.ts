import { APP_NAME } from '@/constants/app';
import { t } from '@/i18n';

import { MODELS } from './models';

export type ApiErrorKind =
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

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Raw message from the API, if any. */
  readonly apiMessage?: string;

  constructor(kind: ApiErrorKind, message: string, opts: { status?: number; apiMessage?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = opts.status;
    this.apiMessage = opts.apiMessage;
  }

  get retryable(): boolean {
    return ['rate_limit', 'overloaded', 'server', 'network'].includes(this.kind);
  }
}

/** Server messages can quote model IDs; people see the app's model names instead. */
export function withModelNames(text: string): string {
  return MODELS.reduce((out, m) => out.split(m.id).join(m.label), text);
}

/** Maps an HTTP error from the model API to a friendly error. */
export function errorFromResponse(status: number, apiMessage: string | undefined): ApiError {
  const detail = apiMessage?.trim();
  const opts = { status, apiMessage: detail };
  const shown = detail ? withModelNames(detail) : undefined;
  switch (status) {
    case 400:
    case 422:
      return new ApiError('bad_request', shown ? t('error.badRequestDetail', { detail: shown }) : t('error.badRequest'), opts);
    case 401:
      return new ApiError('auth', t('error.auth'), opts);
    case 402:
      return new ApiError('balance', t('error.balance'), opts);
    case 429:
      return new ApiError('rate_limit', t('error.rateLimit'), opts);
    case 503:
      return new ApiError('overloaded', t('error.overloaded', { app: APP_NAME }), opts);
    default:
      if (status >= 500) {
        return new ApiError('server', t('error.server', { app: APP_NAME }), opts);
      }
      return new ApiError(
        'unknown',
        shown ? t('error.unknownDetail', { status, detail: shown }) : t('error.unknown', { status }),
        opts,
      );
  }
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof ApiError) return error.kind === 'aborted';
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    ((error as { name: string }).name === 'AbortError' || (error as { name: string }).name === 'CanceledError')
  );
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAbortError(error)) return new ApiError('aborted', t('transcript.stopped'));
  const message = error instanceof Error ? error.message : String(error);
  return new ApiError('network', t('error.network', { app: APP_NAME, message }));
}
