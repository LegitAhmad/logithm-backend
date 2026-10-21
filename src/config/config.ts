import process from 'process';
import { mongo } from 'mongoose';

function invalid(name: string, requirement: string): never {
  // Never interpolate values: configuration can contain credentials.
  throw new Error(`Invalid configuration: ${name} ${requirement}`);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) invalid(name, 'is required');
  return value;
}

function httpUrl(name: string, value: string, requireHttps = false): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid(name, 'must be an absolute HTTP(S) URL');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (requireHttps && url.protocol !== 'https:')
  ) {
    invalid(name, 'must be an HTTP(S) URL without credentials, query or fragment (HTTPS in production)');
  }
  return url;
}

function duration(name: string, fallback: string): { value: string; milliseconds: number } {
  const value = process.env[name]?.trim() || fallback;
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);
  if (!match) invalid(name, 'must be a positive duration such as 15m or 7d');
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const milliseconds = Number(match[1]) * multipliers[match[2]];
  if (!Number.isSafeInteger(milliseconds)) invalid(name, 'is too large');
  return { value, milliseconds };
}

export default () => {
  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    invalid('NODE_ENV', 'must be development, test or production');
  }
  const production = nodeEnv === 'production';
  const rawPort = process.env.PORT?.trim() || '3000';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    invalid('PORT', 'must be an integer from 1 through 65535');
  }

  const mongodbUri = required('MONGODB_URI');
  try {
    // Use the driver's parser so replica-set host lists and SRV URIs work too.
    // Construction validates syntax without opening a database connection.
    new mongo.MongoClient(mongodbUri);
  } catch {
    invalid('MONGODB_URI', 'must be a MongoDB connection URI');
  }

  const jwtAccessSecret = required('JWT_ACCESS_SECRET');
  const jwtRefreshSecret = required('JWT_REFRESH_SECRET');
  if (jwtAccessSecret === jwtRefreshSecret) {
    invalid('JWT_ACCESS_SECRET/JWT_REFRESH_SECRET', 'must be different');
  }
  if (production) {
    for (const [name, value] of [
      ['JWT_ACCESS_SECRET', jwtAccessSecret],
      ['JWT_REFRESH_SECRET', jwtRefreshSecret],
    ]) {
      if (
        Buffer.byteLength(value) < 32 ||
        new Set(value).size < 12 ||
        /change[-_ ]?me|change[-_ ]?in|example|placeholder|dev[-_ ]|your[-_ ]|secret[-_ ]/i.test(value)
      ) {
        invalid(name, 'must be a distinct randomly generated secret of at least 32 bytes in production');
      }
    }
  }

  const rawOrigins = production
    ? required('CORS_ORIGINS')
    : process.env.CORS_ORIGINS?.trim() || 'http://localhost:4200';
  const corsOrigins = rawOrigins.split(',').map((origin) => {
    const value = origin.trim();
    const url = httpUrl('CORS_ORIGINS', value, production);
    if (url.pathname !== '/' || value !== url.origin) {
      invalid('CORS_ORIGINS', 'must contain comma-separated exact origins without paths or trailing slashes');
    }
    if (
      url.hostname.includes('*') ||
      (production &&
        (/^(localhost\.?|127(?:\.\d+){3}|\[::1\]|\[::\]|0\.0\.0\.0)$/i.test(url.hostname) ||
          url.hostname.endsWith('.localhost')))
    ) {
      invalid('CORS_ORIGINS', 'must not contain loopback or wildcard origins in production');
    }
    return url.origin;
  });

  const jwtAccessExpiresIn = duration('JWT_ACCESS_EXPIRES_IN', '15m');
  const jwtRefreshExpiresIn = duration('JWT_REFRESH_EXPIRES_IN', '7d');
  const pistonUrl = httpUrl('PISTON_URL', required('PISTON_URL')).toString().replace(/\/$/, '');
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || undefined;
  const supabasePublicKey = process.env.SUPABASE_PUBLIC_KEY?.trim() || undefined;
  const supabasePrivateKey = process.env.SUPABASE_PRIVATE_KEY?.trim() || undefined;
  const supabaseBucket = process.env.SUPABASE_BUCKET?.trim() || undefined;
  if (supabaseUrl || supabasePublicKey || supabasePrivateKey || supabaseBucket) {
    if (!supabaseUrl || !(supabasePrivateKey || supabasePublicKey)) {
      invalid('SUPABASE_URL/SUPABASE_PRIVATE_KEY', 'must be configured together (or omit all SUPABASE_* variables)');
    }
    httpUrl('SUPABASE_URL', supabaseUrl, production);
  }

  return {
    nodeEnv,
    port: Number(rawPort),
    corsOrigins,
    mongodbUri,
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessExpiresIn: jwtAccessExpiresIn.value,
    jwtRefreshExpiresIn: jwtRefreshExpiresIn.value,
    jwtRefreshCookieMaxAge: jwtRefreshExpiresIn.milliseconds,
    supabaseUrl,
    supabasePublicKey,
    supabasePrivateKey,
    supabaseBucket,
    pistonUrl,
  };
};
