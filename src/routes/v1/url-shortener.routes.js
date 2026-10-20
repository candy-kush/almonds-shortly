import express from "express";
import { openCompressionController } from '../../controllers/v1/url-shortener.controller.js';

const router = express.Router();

router.route("/url/compress").post(openCompressionController);

export default router;
