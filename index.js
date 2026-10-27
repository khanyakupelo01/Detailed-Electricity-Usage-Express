const config = require('./config');
const logger = require('./logger');
const ExpressServer = require('./expressServer');

let expressServer;

const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down Express server`);
  if (expressServer) {
    await expressServer.close();
  }
};

const handleShutdown = (signal) => {
  shutdown(signal).catch((error) => {
    logger.error('Express Server shutdown failure', error.message);
    process.exitCode = 1;
  });
};

process.once('SIGINT', () => handleShutdown('SIGINT'));
process.once('SIGTERM', () => handleShutdown('SIGTERM'));

const launchServer = async () => {
  try {
    expressServer = new ExpressServer(config.URL_PORT, config.OPENAPI_YAML);
    expressServer.launch();
    logger.info('Express server running');
  } catch (error) {
    logger.error('Express Server failure', error.message);
    if (expressServer) {
      await expressServer.close();
    }
    process.exitCode = 1;
  }
};

launchServer().catch((e) => logger.error(e));
