import config from './config';

describe('runtime configuration', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/logithm',
      JWT_ACCESS_SECRET: 'test-access',
      JWT_REFRESH_SECRET: 'test-refresh',
      PISTON_URL: 'http://executor:2000',
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  it('runs without optional avatar storage or Redis', () => {
    expect(config()).toMatchObject({
      port: 3000,
      corsOrigins: ['http://localhost:4200'],
      jwtRefreshCookieMaxAge: 604800000,
      supabaseUrl: undefined,
    });
  });

  it.each(['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'PISTON_URL'])(
    'rejects missing %s with an actionable variable name',
    (name) => {
      delete process.env[name];
      expect(config).toThrow(name);
    },
  );

  it.each([
    ['PORT', '3000garbage'],
    ['PORT', '65536'],
    ['NODE_ENV', 'prod'],
    ['MONGODB_URI', 'postgresql://localhost/logithm'],
    ['PISTON_URL', 'http://user:password@executor:2000'],
    ['JWT_ACCESS_EXPIRES_IN', 'tomorrow'],
    ['CORS_ORIGINS', '*'],
    ['CORS_ORIGINS', 'https://*.example.com'],
    ['CORS_ORIGINS', 'https://learn.example.com/path'],
  ])('rejects malformed %s with an actionable variable name', (name, value) => {
    process.env[name] = value;
    expect(config).toThrow(name);
  });

  it('does not expose URL credentials in configuration errors', () => {
    process.env.PISTON_URL = 'http://user:sensitive-password@executor:2000';
    expect(config).toThrow('PISTON_URL');
    try {
      config();
    } catch (error) {
      expect((error as Error).message).not.toContain('sensitive-password');
    }
  });

  it('accepts MongoDB replica-set host lists', () => {
    process.env.MONGODB_URI = 'mongodb://mongo1:27017,mongo2:27017/logithm?replicaSet=rs0';
    expect(config().mongodbUri).toEqual(process.env.MONGODB_URI);
  });

  it('rejects partially configured optional storage', () => {
    process.env.SUPABASE_URL = 'https://storage.example.com';
    expect(config).toThrow('SUPABASE_URL/SUPABASE_PRIVATE_KEY');
  });

  describe('production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'a013456789bcdef0123456789abcdef0123456789abcdef';
      process.env.JWT_REFRESH_SECRET = 'b013456789bcdef0123456789abcdef0123456789abcdef';
      process.env.CORS_ORIGINS = 'https://learn.example.com';
    });

    it('accepts explicit secure production configuration', () => {
      expect(config().nodeEnv).toBe('production');
    });

    it('requires an explicit frontend origin', () => {
      delete process.env.CORS_ORIGINS;
      expect(config).toThrow('CORS_ORIGINS');
    });

    it.each(['http://learn.example.com', 'https://localhost', 'https://127.0.0.1'])(
      'rejects insecure production origin %s',
      (origin) => {
        process.env.CORS_ORIGINS = origin;
        expect(config).toThrow('CORS_ORIGINS');
      },
    );

    it('rejects short or placeholder secrets', () => {
      process.env.JWT_ACCESS_SECRET = 'dev-access-secret-change-in-production';
      expect(config).toThrow('JWT_ACCESS_SECRET');
    });

    it('requires distinct access and refresh secrets', () => {
      process.env.JWT_REFRESH_SECRET = process.env.JWT_ACCESS_SECRET;
      expect(config).toThrow('JWT_ACCESS_SECRET/JWT_REFRESH_SECRET');
    });
  });
});
