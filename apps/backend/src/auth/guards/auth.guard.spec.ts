import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { InternalJwtAuthGuard } from './internal-jwt-auth.guard';
import { PublicAuthGuard } from './public-auth.guard';

function makeCtx(): ExecutionContext {
  return {} as ExecutionContext;
}

describe('AuthGuard', () => {
  let publicGuard: jest.Mocked<PublicAuthGuard>;
  let internalGuard: jest.Mocked<InternalJwtAuthGuard>;
  let guard: AuthGuard;

  beforeEach(() => {
    publicGuard = { canActivate: jest.fn() } as any;
    internalGuard = { canActivate: jest.fn() } as any;
    guard = new AuthGuard(publicGuard, internalGuard);
  });

  it('returns true immediately for public routes without checking other guards', async () => {
    publicGuard.canActivate.mockReturnValue(true);
    const result = await guard.canActivate(makeCtx());
    expect(result).toBe(true);
    expect(internalGuard.canActivate).not.toHaveBeenCalled();
  });

  it('delegates to InternalJwtAuthGuard for non-public routes', async () => {
    publicGuard.canActivate.mockReturnValue(false);
    internalGuard.canActivate.mockReturnValue(true);

    const result = await guard.canActivate(makeCtx());

    expect(result).toBe(true);
    expect(internalGuard.canActivate).toHaveBeenCalled();
  });
});
