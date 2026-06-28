import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { InternalJwtAuthGuard } from './internal-jwt-auth.guard';
import { KeycloakJwtAuthGuard } from './keycloak-jwt-auth.guard';
import { PublicAuthGuard } from './public-auth.guard';

function makeCtx(): ExecutionContext {
  return {} as ExecutionContext;
}

describe('AuthGuard', () => {
  let publicGuard: jest.Mocked<PublicAuthGuard>;
  let keycloakGuard: jest.Mocked<KeycloakJwtAuthGuard>;
  let internalGuard: jest.Mocked<InternalJwtAuthGuard>;
  let guard: AuthGuard;

  beforeEach(() => {
    publicGuard = { canActivate: jest.fn() } as any;
    keycloakGuard = { canActivate: jest.fn() } as any;
    internalGuard = { canActivate: jest.fn() } as any;
    guard = new AuthGuard(publicGuard, keycloakGuard, internalGuard);
  });

  afterEach(() => {
    delete process.env.INTERNAL_AUTH_ENABLED;
  });

  it('returns true immediately for public routes without checking other guards', async () => {
    publicGuard.canActivate.mockReturnValue(true);
    const result = await guard.canActivate(makeCtx());
    expect(result).toBe(true);
    expect(keycloakGuard.canActivate).not.toHaveBeenCalled();
    expect(internalGuard.canActivate).not.toHaveBeenCalled();
  });

  it('delegates to Keycloak guard when INTERNAL_AUTH_ENABLED is not set', async () => {
    delete process.env.INTERNAL_AUTH_ENABLED;
    publicGuard.canActivate.mockReturnValue(false);
    keycloakGuard.canActivate.mockResolvedValue(true);

    const result = await guard.canActivate(makeCtx());

    expect(result).toBe(true);
    expect(keycloakGuard.canActivate).toHaveBeenCalled();
    expect(internalGuard.canActivate).not.toHaveBeenCalled();
  });

  it('delegates to Keycloak guard when INTERNAL_AUTH_ENABLED=false', async () => {
    process.env.INTERNAL_AUTH_ENABLED = 'false';
    publicGuard.canActivate.mockReturnValue(false);
    keycloakGuard.canActivate.mockResolvedValue(true);

    await guard.canActivate(makeCtx());

    expect(keycloakGuard.canActivate).toHaveBeenCalled();
    expect(internalGuard.canActivate).not.toHaveBeenCalled();
  });

  it('delegates to InternalJwtAuthGuard when INTERNAL_AUTH_ENABLED=true', async () => {
    process.env.INTERNAL_AUTH_ENABLED = 'true';
    publicGuard.canActivate.mockReturnValue(false);
    internalGuard.canActivate.mockReturnValue(true);

    const result = await guard.canActivate(makeCtx());

    expect(result).toBe(true);
    expect(internalGuard.canActivate).toHaveBeenCalled();
    expect(keycloakGuard.canActivate).not.toHaveBeenCalled();
  });
});
