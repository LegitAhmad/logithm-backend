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
  const supabasePrivateKey = process.env.SUPABASE_PRIVATE_KEY;
  const supabaseBucket = process.env.SUPABASE_BUCKET;
  const pistonUrl = process.env.PISTON_URL;
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;
  const redisUnixSocket = process.env.REDIS_UNIX_SOCKET;

  return {
    nodeEnv,
    port,
    mongodbUri,
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessExpiresIn,
    jwtRefreshExpiresIn,
    supabaseUrl,
    supabasePublicKey,
    supabasePrivateKey,
    supabaseBucket,
    pistonUrl,
    redisHost,
    redisPort,
    redisUnixSocket,
  };
};
