import httpStatus from "http-status";
import urlShortenerService from "../services/url-shortener.services.js";

const openCompression = async (req, res) => {
  try {
    console.log("inside openCompression method");
    const response = await urlShortenerService.openCompression(req.body);
    console.log("openCompression response: ", response);
    res.status(httpStatus.status.OK).send(response);
  } catch (error) {
    res.status(error.statusCode).send({ code: error.statusCode, message: error.message });
  }
};

const redirectController = async (req, res) => {
  try {
    console.log("inside redirectController method");
    const response = await urlShortenerService.redirectService(req.params);
    console.log("redirectController response: ", response);
    return res.redirect(httpStatus.status.FOUND, response.url);

  } catch (error) {
    res.status(error.statusCode).send({ code: error.statusCode, message: error.message });
  }
};

export {
  openCompression,
  redirectController,
};
