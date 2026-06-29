/**
 * Command bus.
 *
 * Commands express intent ("CreateProject", "ImportAsset") and are handled
 * by exactly one handler each. This decouples the issuer from the handler
 * and gives us a single chokepoint for validation, logging, and events.
 */
import { container, token } from "./service-container.js";

export interface Command<TPayload = unknown, TResult = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  /** Phantom type marker — correlates a command with its dispatch result. */
  readonly _result?: TResult;
}

export type CommandHandler<TPayload, TResult> = (
  payload: TPayload,
) => Promise<TResult> | TResult;

const HANDLERS_TOKEN = token<Map<string, CommandHandler<unknown, unknown>>>(
  "command-handlers",
);

function handlers(): Map<string, CommandHandler<unknown, unknown>> {
  if (!container.resolve(HANDLERS_TOKEN)) {
    container.register(HANDLERS_TOKEN, () => new Map());
  }
  return container.resolve(HANDLERS_TOKEN);
}

export function registerHandler<TPayload, TResult>(
  type: string,
  handler: CommandHandler<TPayload, TResult>,
): void {
  const map = handlers();
  if (map.has(type)) {
    throw new Error(`A handler is already registered for command "${type}".`);
  }
  map.set(type, handler as CommandHandler<unknown, unknown>);
}

export async function dispatch<TPayload, TResult>(
  command: Command<TPayload, TResult>,
): Promise<TResult> {
  const handler = handlers().get(command.type);
  if (!handler) {
    throw new Error(`No handler registered for command "${command.type}".`);
  }
  return (await handler(command.payload)) as TResult;
}
