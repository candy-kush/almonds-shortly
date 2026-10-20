import httpStatus from "http-status";
import { openCompression, redirectService } from "../../services/v1/url-shortener.services.js";

const openCompressionController = async (req, res) => {
  try {
    console.log("inside openCompression method");
    const response = await openCompression(req.body);
    res.status(httpStatus.OK).send(response);
  } catch (error) {
    return res.status(error.statusCode ?? httpStatus.INTERNAL_SERVER_ERROR).send({ code: error.statusCode ?? 500, message: error.message || "Something went wrong" });
  }
};

const redirectController = async (req, res) => {
  try {
    console.log("inside redirectController method");
    const response = await redirectService(req.params);
    return res.redirect(httpStatus.FOUND, response.url);

  } catch (error) {
    return res.status(error.statusCode ?? httpStatus.INTERNAL_SERVER_ERROR).send({ code: error.statusCode ?? 500, message: error.message || "Something went wrong" });
  }
};

export {
  openCompressionController,
  redirectController,
};
