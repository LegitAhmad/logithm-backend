import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RefreshSession } from '../user/schemas/user.schema';

// Stateful persistence seam: tokens still use real signing, verification, expiry,
// random identifiers and hashing. Run the API smoke for database atomicity.
class Sessions {
  readonly rows: Record<string, RefreshSession[]> = {};
  async addRefreshSession(userId: string, session: RefreshSession) {
    this.rows[userId] = [...(this.rows[userId] ?? []), session].slice(-10);
  }
  async rotateRefreshSession(userId: string, hash: string, session: RefreshSession) {
    const index = (this.rows[userId] ?? []).findIndex(row => row.tokenHash === hash && row.expiresAt > new Date());
    if (index < 0) throw new UnauthorizedException();
    this.rows[userId][index] = session;
  }
  async revokeRefreshSession(userId: string, hash: string) {
    this.rows[userId] = (this.rows[userId] ?? []).filter(row => row.tokenHash !== hash);
  }
}

function responseCookies() {
  const cookies: Record<string, string> = {};
  const response = {
    cookie(name: string, value: string) { cookies[name] = value; },
    clearCookie(name: string) { delete cookies[name]; },
  } as unknown as Response;
  return { response, cookies };
}

describe('Refresh session credentials', () => {
  const userId = '507f1f77bcf86cd799439011';
  let store: Sessions;
  let auth: AuthService;
  beforeEach(() => {
    store = new Sessions();
    auth = new AuthService(store as unknown as UserService, new JwtService(), new ConfigService({
      nodeEnv: 'test', jwtAccessSecret: 'test-access-secret-with-adequate-length', jwtRefreshSecret: 'different-refresh-secret-with-adequate-length', jwtAccessExpiresIn: '15m', jwtRefreshExpiresIn: '7d',
    }));
  });

  it('exposes only access tokens in JSON and persists only hashed refresh credentials', async () => {
    const jar = responseCookies();
    const body = await auth.generateTokens(userId, jar.response);
    expect(Object.keys(body)).toEqual(['accessToken']);
    expect(typeof body.accessToken).toBe('string');
    expect(jar.cookies.refreshToken).toBeTruthy();
    expect(store.rows[userId][0].tokenHash).toMatch(/^[a-f\d]{64}$/);
    expect(JSON.stringify(store.rows)).not.toContain(jar.cookies.refreshToken);
  });

  it('rejects replay of a rotated cookie but accepts the replacement immediately', async () => {
    const jar = responseCookies();
    await auth.generateTokens(userId, jar.response);
    const original = jar.cookies.refreshToken;
    await auth.refresh(original, jar.response);
    const replacement = jar.cookies.refreshToken;
    expect(replacement).not.toBe(original);
    await expect(auth.refresh(original, jar.response)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.refresh(replacement, jar.response)).resolves.toHaveProperty('accessToken');
  });

  it('allows exactly one refresh for concurrent uses of the same cookie', async () => {
    const jar = responseCookies();
    await auth.generateTokens(userId, jar.response);
    const original = jar.cookies.refreshToken;
    const results = await Promise.allSettled([auth.refresh(original, jar.response), auth.refresh(original, jar.response)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('revokes the logged-out session while preserving a different signed-in session', async () => {
    const first = responseCookies();
    const second = responseCookies();
    await auth.generateTokens(userId, first.response);
    await auth.generateTokens(userId, second.response);
    const revoked = first.cookies.refreshToken;
    await auth.logout(first.response, revoked);
    expect(first.cookies.refreshToken).toBeUndefined();
    await expect(auth.refresh(revoked, first.response)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.refresh(second.cookies.refreshToken, second.response)).resolves.toHaveProperty('accessToken');
  });

  it('rejects an altered cookie and permits idempotent logout without credentials', async () => {
    const jar = responseCookies();
    await auth.generateTokens(userId, jar.response);
    const token = jar.cookies.refreshToken;
    await expect(auth.refresh(`x${token}`, jar.response)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.logout(jar.response, 'invalid-token')).resolves.toBeUndefined();
    await expect(auth.logout(jar.response)).resolves.toBeUndefined();
  });
});
