const crypto = require("crypto");
const httpStatus = require("http-status");
const { ErrorInstance } = require("./errorInstance.utils");

const getRandomHashCode = (length) => {
  const bytes = parseInt(Math.floor(length * 3 / 4));
  const hash = crypto.randomBytes(bytes).toString("base64url");
  return hash;
};

const hashUrl = (url, mode) => {
  const secret = process.env.URL_HASH_SECRET;
  if(mode?.toLowerCase() == 'strict') {
    console.log("HASHING_MODE: ", mode);
    return crypto.createHmac("sha256", secret).update(url + Date.now()).digest("base64url");
  }
  return crypto.createHmac("sha256", secret).update(url).digest("base64url");
};

const getShortCode = (code, length) => {
  return code.slice(0, length);
};

const validateLongUrl = (longUrl) => {
  const allowedProtocols = ["http:", "https:"];
  const parsed = new URL(longUrl);
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new ErrorInstance(
      httpStatus.status.BAD_REQUEST,
      "Redirection blocked",
    );
  }

  if (parsed.hostname === process.env.SHORTLY_BASE_URL) {
    throw new ErrorInstance(
      httpStatus.status.CONFLICT,
      "Self redirection blocked",
    );
  }
};

module.exports = {
  getRandomHashCode,
  getShortCode,
  hashUrl,
  validateLongUrl
};
