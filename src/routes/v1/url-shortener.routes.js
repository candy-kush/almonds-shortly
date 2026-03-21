import express from "express";
import { openCompression } from '../../controllers/url-shortener.controller';

const router = express.Router();

router.route("/compress").post(openCompression);

export default router;
