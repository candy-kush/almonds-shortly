import express from 'express';
import urlShortenerRoute from './url-shortener.routes.js';

const router = express.Router();

const contextRoutes = [
  {
    path: '/url',
    route: urlShortenerRoute,
  },
];

contextRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;