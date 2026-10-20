import "dotenv/config";
import "../../almonds-static/configs/logger.js";
import './utils/nginxLogShipper.utils.js';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import crypto from 'crypto';
import dayjs from 'dayjs';

import routesV1 from './routes/v1/url-shortener.routes.js';
import { redirectController } from "./controllers/v1/url-shortener.controller.js";
import { initializePostgresDB, loggerStorage } from "../../almonds-static/configs/index.js";
import { requestRateLimiter } from "../../almonds-static/middlewares/index.js";
import { healthCheckupMessages } from "../../almonds-static/utils/healthCheckupMessages.utils.js";

const PORT = process.env.PORT || 3000;

const app = express();

app.set('trust proxy', '1');
app.set('etag', false)

app.use((req, res, next) => {
  const reqId = req.headers['x-amzn-trace-id'] || crypto.randomUUID();
  const startTime = process.hrtime.bigint();
  const ip = req.ip || req.socket.remoteAddress;

  const context = Object.freeze({
    reqId,
    url: req.originalUrl,
  });

  loggerStorage.run(context, () => {
    console.log(`Request: ${ip} ${req.method} ${req.originalUrl}`);
    console.log(`${ip}, ${req.headers["deviceid"] || 'NA'}, ${req.headers["templateid"] || "NA"}, ${req.headers["latitude"] || "NA"}, ${req.headers["longitude"] || "NA"}, ${req.headers["osversion"] || "NA"}, ${req.headers["appversion"] || "NA"}, ${req.headers['user-agent'] || "NA"}`);
  
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      console.log(`Response: ${ip} ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs.toFixed(2)}ms`);
    });
  
    next();
  });
});

await initializePostgresDB();

app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

app.use(requestRateLimiter);

app.use('/apis/v1', routesV1);

app.get(/^\/([A-Za-z0-9_-]{8,12})$/, redirectController);

app.get('/shortly/health', (req, res) => {
  const randomBanter = healthCheckupMessages[crypto.randomInt(0, healthCheckupMessages.length)];
  res.status(200).json({ 
    status: "OK", 
    statusCode: 200,
    message: randomBanter, 
    timestamp: dayjs().toISOString() 
  });
});

app.use((err, req, res, next) => {
  const store = loggerStorage.getStore();
  const prefix = `${store?.reqId || "SYSTEM"} ${store?.url || "NA"}`;
  console.error(`${prefix} Uncaught Error:`, err);
  const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
    statusCode: statusCode,
    message: statusCode === 500 ? "Internal Server Error" : err.message,
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  const store = loggerStorage.getStore();
  const prefix = `${store?.reqId || "SYSTEM"} ${store?.url || "NA"}`;
  console.log(`\nReceived ${signal}. Launching graceful termination...`);
  console.log(prefix);

  server.close(async () => {
    console.log("HTTP server stopped accepting traffic.");
    try {
      console.log("Infrastructure dependencies disconnected safely.");
      process.exit(0);
    } catch (err) {
      console.error("Error occurred during dependency cleanup:", err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("Shutdown deadline breached. Enforcing hard kill.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  const store = loggerStorage.getStore();
  const prefix = `${store?.reqId || "SYSTEM"} ${store?.url || "NA"}`;
  console.error("CRITICAL: Uncaught Exception:", err);
  console.log(prefix);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  const store = loggerStorage.getStore();
  const prefix = `${store?.reqId || "SYSTEM"} ${store?.url || "NA"}`;
  console.error("CRITICAL: Unhandled Rejection:", reason);
  console.log(prefix);
  shutdown("unhandledRejection");
});
