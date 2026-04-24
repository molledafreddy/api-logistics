import AppDataSource from './src/database/data-source';

AppDataSource.initialize()
  .then(() => {
    console.log('Data Source has been initialized!');
    process.exit(0);
  })
  .catch((err: any) => {
    console.error('Error during Data Source initialization:', err);
    process.exit(1);
  });
