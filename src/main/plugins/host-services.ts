/**
 * Host service implementations injected into plugin contexts.
 *
 * Phase 1 ships a REAL EventService (adapter over the existing event bus)
 * and a working NotificationService (logs at the matching level). The rest
 * throw "not implemented" loudly — silent stubs returning fake data would
 * let plugins operate on garbage.
 */
import { eventBus } from "@main/core/event-bus.js";
import { createLogger } from "@main/core/logger.js";
import type {
  AIService,
  AssetService,
  EventService,
  FileService,
  GraphService,
  MediaService,
  NotificationService,
  ProjectService,
  PromptService,
} from "@shared/sdk/index.js";

const log = createLogger("plugins:host");

/** Real EventService backed by the in-process event bus. */
function createEventService(unsubscribeTrackers: Set<() => void>): EventService {
  return {
    subscribe: (type, handler) => {
      // The SDK EventHandler and eventBus Handler share the same shape but
      // TS can't unify their independently-defined generics; cast at the seam.
      const dispose = eventBus.on(type, handler as never);
      unsubscribeTrackers.add(dispose);
      return dispose;
    },
    publish: (type, payload) => {
      eventBus.emit(type, payload as never);
    },
  };
}

/** Real NotificationService that logs at the matching level. */
function createNotificationService(): NotificationService {
  return {
    show(notification) {
      const { level, message } = notification;
      if (level === "error") log.error(message, { actionLabel: notification.actionLabel });
      else if (level === "warning") log.warn(message, { actionLabel: notification.actionLabel });
      else log.info(message, { actionLabel: notification.actionLabel });
    },
  };
}

/** A service whose methods all throw "not implemented". */
function notImplemented(service: string): never {
  throw new Error(`${service} not implemented — arrives in a later phase.`);
}

function stubProject(): ProjectService {
  return {
    create: () => notImplemented("ProjectService.create"),
    open: () => notImplemented("ProjectService.open"),
    active: () => notImplemented("ProjectService.active"),
  };
}
function stubAsset(): AssetService {
  return {
    list: () => notImplemented("AssetService.list"),
    read: () => notImplemented("AssetService.read"),
    link: () => notImplemented("AssetService.link"),
  };
}
function stubGraph(): GraphService {
  return {
    relationships: () => notImplemented("GraphService.relationships"),
    connect: () => notImplemented("GraphService.connect"),
  };
}
function stubPrompt(): PromptService {
  return {
    build: () => notImplemented("PromptService.build"),
    history: () => notImplemented("PromptService.history"),
  };
}
function stubAi(): AIService {
  return {
    providers: () => notImplemented("AIService.providers"),
    complete: () => notImplemented("AIService.complete"),
  };
}
function stubFile(): FileService {
  return {
    read: () => notImplemented("FileService.read"),
    write: () => notImplemented("FileService.write"),
    watch: () => notImplemented("FileService.watch"),
  };
}
function stubMedia(): MediaService {
  return {
    generate: () => notImplemented("MediaService.generate"),
    transcode: () => notImplemented("MediaService.transcode"),
  };
}

export interface HostServices {
  project: ProjectService;
  asset: AssetService;
  graph: GraphService;
  prompt: PromptService;
  ai: AIService;
  file: FileService;
  media: MediaService;
  event: EventService;
  notification: NotificationService;
}

/**
 * Build the set of host services. The event-service unsubscribe trackers
 * let the runtime tear down a plugin's subscriptions on deactivate.
 */
export function buildHostServices(
  unsubscribeTrackers: Set<() => void>,
): HostServices {
  return {
    project: stubProject(),
    asset: stubAsset(),
    graph: stubGraph(),
    prompt: stubPrompt(),
    ai: stubAi(),
    file: stubFile(),
    media: stubMedia(),
    event: createEventService(unsubscribeTrackers),
    notification: createNotificationService(),
  };
}
