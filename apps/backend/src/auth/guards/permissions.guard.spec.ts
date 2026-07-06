import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, ANY_PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

function makeCtx(user: any, handler = () => {}, cls = class {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new PermissionsGuard(reflector);
  });

  it('allows when no permissions metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const result = guard.canActivate(makeCtx(null));
    expect(result).toBe(true);
  });

  it('allows when required permissions metadata is an empty array', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const result = guard.canActivate(makeCtx({ permissions: [] }));
    expect(result).toBe(true);
  });

  it('allows when user has all required permissions', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['orders:view', 'runs:view'];
      return undefined;
    });
    const user = { permissions: ['orders:view', 'runs:view', 'orders:create'] };
    expect(guard.canActivate(makeCtx(user))).toBe(true);
  });

  it('throws ForbiddenException when user is missing a required permission', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['orders:delete'];
      return undefined;
    });
    const user = { permissions: ['orders:view'] };
    expect(() => guard.canActivate(makeCtx(user))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has no permissions at all', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['users:view'];
      return undefined;
    });
    const user = { permissions: [] };
    expect(() => guard.canActivate(makeCtx(user))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when req.user is missing', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['orders:view'];
      return undefined;
    });
    expect(() => guard.canActivate(makeCtx(null))).toThrow(ForbiddenException);
  });

  it('reads metadata from both handler and class', () => {
    const handler = () => {};
    const cls = class {};
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['orders:view'];
      return undefined;
    });
    guard.canActivate(makeCtx({ permissions: ['orders:view'] }, handler, cls));
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_KEY, [handler, cls]);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ANY_PERMISSIONS_KEY, [handler, cls]);
  });

  // AnyPermissions (OR) tests
  it('allows when user has at least one of the anyPermissions', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === ANY_PERMISSIONS_KEY) return ['orders:update', 'orders:start-production'];
      return undefined;
    });
    const user = { permissions: ['orders:start-production'] };
    expect(guard.canActivate(makeCtx(user))).toBe(true);
  });

  it('throws ForbiddenException when user has none of the anyPermissions', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === ANY_PERMISSIONS_KEY) return ['orders:update', 'orders:start-production'];
      return undefined;
    });
    const user = { permissions: ['orders:view'] };
    expect(() => guard.canActivate(makeCtx(user))).toThrow(ForbiddenException);
  });
});
