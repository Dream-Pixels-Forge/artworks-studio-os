/**
 * Core: command bus, service container, configuration, logging, event bus.
 * No production logic belongs here.
 */
export { eventBus } from "./event-bus.js";
export { container, token } from "./service-container.js";
export type { ServiceToken } from "./service-container.js";
export { dispatch, registerHandler } from "./command-bus.js";
export type { Command, CommandHandler } from "./command-bus.js";
export { config } from "./config.js";
export type { StudioConfig } from "./config.js";
export { createLogger } from "./logger.js";
export type { Logger, LogLevel } from "./logger.js";
