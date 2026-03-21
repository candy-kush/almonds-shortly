import "dotenv/config";
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import crypto from 'crypto';
import httpContext from 'express-http-context';
import routes from './routes/v1/index';
import { requestRateLimiter, analyticsMiddleware } from "./middlewares";
import { redirectController } from "./controllers/url-shortener.controller";
import './utils/nginxLogShipper.utils';

const PORT = process.env.PORT || 3000;

const app = express();

app.set('trust proxy', '1');
app.use(httpContext.middleware);

app.use((req, res, next) => {
  const reqId = (crypto.getRandomValues(new Uint32Array(1))[0] % 9000000 + 1000000).toString();
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || req.socket.remoteAddress;
  httpContext.set('reqId', reqId);
  httpContext.set('ip', ip);
  next();
});

const originalLog = console.log;
console.log = (...args) => {
  const reqId = httpContext.get('reqId') || 'NOT_DEFINED';
  const ip = httpContext.get('ip') || 'UNKNOWN';
  const callerLine = new Error().stack.split('\n')[2]?.replace('at ', '').trim();
  const prefix = `[${reqId}] - ${ip}`;

  originalLog(`${prefix} ${callerLine || ''}`, ...args);
};

app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();
  httpContext.set('method', req.method);
  httpContext.set('url', req.originalUrl);

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode + " - " + durationMs.toFixed(2) + 'ms'}`);
  });

  next();
});

app.use(helmet());

app.use(express.json({ limit: "100kb" }));

app.use(express.urlencoded({ extended: true }));

app.use(compression());

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
}));

app.use(requestRateLimiter);

app.use('/apis/v1', routes);

app.get(/^\/([A-Za-z0-9_-]{8,12})$/, redirectController);

app.use((err, req, res, next) => {
  console.log(err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).send({
    statusCode: statusCode,
    message: err.message || "Internal Server Error",
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      console.log("Graceful shutdown complete.");
      process.exit(0);
    } catch (err) {
      console.log("Error during shutdown:", err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.log("Forcing shutdown...");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.log("Uncaught Exception:", err);
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  console.log("Unhandled Rejection:", reason);
  shutdown("unhandledRejection");
});
