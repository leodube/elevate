import { logger } from "./logger";

interface LogOptions {
  debug?: boolean;
}

export function LogMethod(options: LogOptions = {}) {
  const { debug = false } = options;

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const qualifiedName = `${className}.${propertyKey}`;

    descriptor.value = function (...args: any[]) {
      const start = Date.now();
      logger.info(`Calling ${qualifiedName}`);

      const logSuccess = (result: any) => {
        const duration = Date.now() - start;
        logger.info(`Finished ${qualifiedName} ${duration}ms`);
        if (debug || logger.isLevelEnabled("debug")) {
          logger.debug({ args, result }, `Result for ${qualifiedName}`);
        }
        return result;
      };

      const logFailure = (error: any) => {
        const duration = Date.now() - start;
        logger.error({ method: propertyKey, duration, err: error }, `Failed ${qualifiedName} after ${duration}ms`);
        throw error;
      };

      let result: any;
      try {
        result = originalMethod.apply(this, args);
      } catch (error) {
        return logFailure(error);
      }

      if (result && typeof result.then === "function") {
        return result.then(logSuccess, logFailure);
      }

      return logSuccess(result);
    };

    return descriptor;
  };
}
