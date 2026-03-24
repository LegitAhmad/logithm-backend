import process from 'process';

export default () => {
  const nodeEnv = process.env.NODE_ENV;
  const port = process.env.PORT || '3000';
  const mongodbUri = process.env.MONGODB_URI;
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN;
  const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublicKey = process.env.SUPABASE_PUBLIC_KEY;
  const supabasePrivateKey =
    process.env.SUPABASE_PRIVATE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseBucket = process.env.SUPABASE_BUCKET;

  if (!nodeEnv || !mongodbUri) {
    throw new Error(
      'The environment variables are required, but not specified correctly.\n Place the .env file at the root of your project.',
    );
  }
  return {
    mongodbUri: mongodbUri,
    isDev: nodeEnv === 'development',
    nodeEnv: nodeEnv,
    port: port,
    jwtRefreshSecret: jwtRefreshSecret,
    jwtAccessSecret: jwtAccessSecret,
    jwtAccessExpiresIn: jwtAccessExpiresIn,
    jwtRefreshExpiresIn: jwtRefreshExpiresIn,
    supabaseUrl: supabaseUrl,
    supabasePublicKey: supabasePublicKey,
    supabasePrivateKey: supabasePrivateKey,
    supabaseBucket: supabaseBucket,
  };
};
