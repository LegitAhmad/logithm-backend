import process from 'process';

export default () => {
  const nodeEnv = process.env.NODE_ENV;
  const port = process.env.PORT || '3000';
  const mongodbUri = process.env.MONGODB_URI;
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN;
  const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;

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
  };
};
