/**
 * Event bus.
 *
 * Every module communicates through events rather than direct dependencies.
 * This is a synchronous, in-process pub/sub skeleton; the typed event map
 * (see src/shared/events) constrains what can be published.
 */
import type { StudioEvent, StudioEventType } from "@shared/events/index.js";

type Handler<T extends StudioEventType> = (
  payload: Extract<StudioEvent, { type: T }>["payload"],
) => void;

/** Internal handler is type-erased; type-safety is enforced at the API. */
type AnyHandler = (payload: unknown) => void;

class EventBus {
  private handlers = new Map<StudioEventType, Set<AnyHandler>>();

  on<T extends StudioEventType>(type: T, handler: Handler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set<AnyHandler>();
    set.add(handler as AnyHandler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler as AnyHandler);
    };
  }

  emit<T extends StudioEventType>(
    type: T,
    payload: Extract<StudioEvent, { type: T }>["payload"],
  ): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
export type { Handler };
