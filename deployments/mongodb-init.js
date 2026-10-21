// Runs only on an empty MongoDB data volume. Keep root credentials off the API.
const applicationDatabase = db.getSiblingDB('logithm');
applicationDatabase.createUser({
  user: 'logithm',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'logithm' }],
});
