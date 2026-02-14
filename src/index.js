require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const httpContext = require('express-http-context');
const routes = require('./routes/v1/index');
const { requestRateLimiter, analyticsMiddleware } = require("./middlewares");
const { redirectController } = require("./controllers/url-shortener.controller");
require('./utils/nginxLogShipper.utils');

const PORT = process.env.PORT || 3000;

const app = express();

app.set('trust proxy', '1');
app.use(httpContext.middleware);

app.use((req, res, next) => {
  const reqId = Math.floor(1000000 + Math.random() * 9000000);
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;