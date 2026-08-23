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

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();

      logger.info(`Calling ${qualifiedName}`);

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;

        logger.info(`Finished ${qualifiedName} ${duration}ms`);

        // Conditional debug log that includes the result payload
        if (debug || logger.isLevelEnabled("debug")) {
          logger.debug({ args, result }, `Result for ${qualifiedName}`);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error({ method: propertyKey, duration, err: error }, `Failed ${qualifiedName} after ${duration}ms`);
        throw error;
      }
    };

    return descriptor;
  };
}
