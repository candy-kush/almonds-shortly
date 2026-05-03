import { Tail } from "tail";
import { analyticsQueue } from "../../../almonds-static/configs/index.js";

const LOG_FILE = process.env.NGINX_LOG_FILE;

const tail = new Tail(LOG_FILE, {
  useWatchFile: true,
  interval: 1000,
  fromBeginning: false,
  fsWatchOptions: { interval: 500 },
  follow: true,
  logger: console
});

tail.on("line", async (line) => {
  try {
    const data = JSON.parse(line);

    const payload = {
      shortCode: data.shortCode.replace("/", ""),
      ip: data.x_forwarded_for?.split(",")[0] || data.ip,
      userAgent: data.userAgent,
      referrer: data.referrer,
      createdAt: data.createdAt,
      broker: data.broker,
    };

    console.log("pushing to analyticsQueue, payload: ", payload);
    analyticsQueue.add("raw-click", payload);

  } catch (error) {
    console.log("Tail-NGINX log parse error:", error.message);
  }
});

tail.on("error", (error) => {
  console.log("Tail-NGINX error:", error);
});
