import process from 'process';

export default () => {
  const nodeEnv = process.env.NODE_ENV;
  const port = process.env.PORT || '3000';
  const mongodbUri = process.env.MONGODB_URI;

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
  };
};
