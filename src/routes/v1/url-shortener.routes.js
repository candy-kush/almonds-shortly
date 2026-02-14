const express = require("express");
const { urlShortenerController } = require('../../controllers');
const router = express.Router();

router.route("/compress").post(urlShortenerController.openCompression);

module.exports = router;
