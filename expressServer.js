// const { Middleware } = require('swagger-express-middleware');
const http = require('http');
const fs = require('fs');
const path = require('path');
const swaggerUI = require('swagger-ui-express');
const jsYaml = require('js-yaml');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const OpenApiValidator = require('express-openapi-validator');
const logger = require('./logger');
const config = require('./config');
const jwtSecurity = require('./middleware/jwtSecurity');
const db = require('./db/pool');

class ExpressServer {
  constructor(port, openApiYaml) {
    this.port = port;
    this.app = express();
    this.openApiPath = openApiYaml;
    try {
      this.schema = jsYaml.safeLoad(fs.readFileSync(openApiYaml));
    } catch (e) {
      logger.error('failed to start Express Server', e.message);
    }
    this.setupMiddleware();
  }

  setupMiddleware() {
    // this.setupAllowedMedia();
    // Allow any origin (Swagger UI, the frontend, curl) and answer preflights before validation
    const corsOptions = {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      maxAge: 86400,
    };
    this.app.use(cors(corsOptions));
    this.app.options('*', cors(corsOptions));
    this.app.use(bodyParser.json({ limit: '14MB' }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(cookieParser());
    // Open the Swagger docs when the home page is visited
    this.app.get('/', (req, res) => res.redirect('/api-docs'));
    // View the openapi document in a visual interface. Should be able to test from this page
    this.app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(this.schema));

    this.app.use(
      OpenApiValidator.middleware({
        apiSpec: this.openApiPath,
        operationHandlers: path.join(__dirname),
        fileUploader: { dest: config.FILE_UPLOAD_PATH },
        validateSecurity: {
          handlers: {
            bearerAuth: jwtSecurity.bearerAuth,
          },
        },
      }),
    );
  }

  launch() {
    // eslint-disable-next-line no-unused-vars
    this.app.use((err, req, res, next) => {
      const status = err.status || 500;
      const messages = Array.isArray(err.errors)
        ? err.errors.map((item) => item.message).filter(Boolean)
        : [];
      const errorCodes = {
        400: 'INVALID_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        422: 'UNPROCESSABLE_ENTITY',
        500: 'INTERNAL_SERVER_ERROR',
        503: 'SERVICE_UNAVAILABLE',
      };
      let message = err.message || 'Invalid request';
      if (status >= 500) {
        message = status === 503
          ? 'Service temporarily unavailable'
          : 'Internal server error';
      }

      res.status(status).json({
        code: errorCodes[status] || 'REQUEST_FAILED',
        message,
        ...(messages.length > 0 ? { errors: messages } : {}),
      });
    });

    this.server = http.createServer(this.app).listen(this.port);
    console.log(`Listening on port ${this.port}`);
  }

  async close() {
    if (this.server !== undefined) {
      await new Promise((resolve, reject) => {
        this.server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    await db.close();
    console.log(`Server on port ${this.port} shut down`);
  }
}

module.exports = ExpressServer;
