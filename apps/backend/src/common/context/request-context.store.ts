import { AsyncLocalStorage } from 'async_hooks';
import { RequestContext } from './request-context';

export const RequestContextStore =
  new AsyncLocalStorage<RequestContext>();
