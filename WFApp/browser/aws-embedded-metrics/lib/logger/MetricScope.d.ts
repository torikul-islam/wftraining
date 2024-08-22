import { MetricsLogger } from './MetricsLogger';
/**
 * An asynchronous wrapper that provides a metrics instance.
 */
declare const metricScope: <T, U extends readonly unknown[]>(handler: (m: MetricsLogger) => (...args: U) => T | Promise<T>) => (...args: U) => Promise<T | undefined>;
export { metricScope };
