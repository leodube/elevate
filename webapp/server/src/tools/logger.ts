import pino from "pino";
import { env } from "../config/env";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: env.logging.level,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-http-print",
          options: {
            all: true,
            colorize: true,
            translateTime: "SYS:HH:MM:ss",

            // Optional: Configure how pino-pretty formats your internal/decorator logs
            prettyOptions: {
              translateTime: "SYS:HH:MM:ss",
              ignore: "pid,hostname"
            }
          }
        }
      })
});
