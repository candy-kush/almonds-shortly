const express = require("express");
const urlShortenerController = require('../../controllers/url-shortener.controller');
const router = express.Router();

router.route("/compress").post(urlShortenerController.openCompression);

module.exports = router;
