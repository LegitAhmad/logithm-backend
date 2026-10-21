// Runs before importing AppModule: never silently use a developer's .env services.
const mongodbUri = process.env.LOGITHM_E2E_MONGODB_URI;
const pistonUrl = process.env.LOGITHM_E2E_PISTON_URL;
if (!mongodbUri || !pistonUrl) {
  throw new Error('Set LOGITHM_E2E_MONGODB_URI to a disposable test database and LOGITHM_E2E_PISTON_URL to a private executor.');
}
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: mongodbUri,
  PISTON_URL: pistonUrl,
  JWT_ACCESS_SECRET: 'integration-access-key-only',
  JWT_REFRESH_SECRET: 'integration-refresh-key-only',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  CORS_ORIGINS: 'http://localhost:4200',
  SUPABASE_URL: '',
  SUPABASE_PUBLIC_KEY: '',
  SUPABASE_PRIVATE_KEY: '',
  SUPABASE_BUCKET: '',
});
