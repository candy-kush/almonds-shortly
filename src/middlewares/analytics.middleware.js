const { analyticsQueue } = require("../../../almonds-static/configs");

const analyticsMiddleware = (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode !== 302) return;

    const payload = {
      shortCode: req.params[0],
      ip: req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
      referrer: req.headers["referer"] || "direct",
      createdAt: new Date(),
    };

    console.log("pushing to analyticsQueue, payload: ", payload);
    analyticsQueue.add("raw-click", payload);
  });

  next();
};

module.exports = {
  analyticsMiddleware,
};
