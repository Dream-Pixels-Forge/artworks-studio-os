/**
 * Host service implementations injected into plugin contexts.
 *
 * Real implementations for Project, Asset, Graph, Event, and Notification
 * services backed by existing repositories. AI, File, Media, and Prompt
 * services remain stubs — they require external integrations that arrive
 * in later phases.
 */
import { eventBus } from "@main/core/event-bus.js";
import { createLogger } from "@main/core/logger.js";
import type { StudioDatabase } from "@main/database/db.js";
import { ProjectRepository } from "@main/database/repositories/project-repository.js";
import { AssetRepository } from "@main/database/repositories/asset-repository.js";
import { GraphRepository } from "@main/database/repositories/graph-repository.js";
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

/** Real ProjectService backed by ProjectRepository. */
function createProjectService(db: StudioDatabase): ProjectService {
  const repo = new ProjectRepository(db);
  return {
    create: (input) => Promise.resolve(repo.create(input)),
    open: (id) => {
      const project = repo.findByUuid(id);
      if (!project) throw new Error(`Project not found: ${id}`);
      return Promise.resolve(project);
    },
    active: () => {
      // Return the most recently updated project as "active"
      const projects = repo.list();
      return Promise.resolve(projects[0] ?? null);
    },
  };
}

/** Real AssetService backed by AssetRepository + GraphRepository. */
function createAssetService(db: StudioDatabase): AssetService {
  const assetRepo = new AssetRepository(db);
  const graphRepo = new GraphRepository(db);
  return {
    list: (filter) => Promise.resolve(assetRepo.list(filter)),
    read: (uuid) => {
      const asset = assetRepo.findByUuid(uuid);
      if (!asset) throw new Error(`Asset not found: ${uuid}`);
      return Promise.resolve(asset);
    },
    link: (assetUuid, targetUuid, relation) => {
      graphRepo.connect(assetUuid, targetUuid, relation);
      return Promise.resolve();
    },
  };
}

/** Real GraphService backed by GraphRepository. */
function createGraphService(db: StudioDatabase): GraphService {
  const repo = new GraphRepository(db);
  return {
    relationships: (from) => Promise.resolve(repo.relationships(from)),
    connect: (source, target, type) => {
      repo.connect(source, target, type);
      return Promise.resolve();
    },
  };
}

/** A service whose methods all throw "not implemented". */
function notImplemented(service: string): never {
  throw new Error(`${service} not implemented — arrives in a later phase.`);
}

function stubService<T>(name: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      return () => notImplemented(`${name}.${String(prop)}`);
    },
  });
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
function stubPrompt(): PromptService {
  return {
    build: () => notImplemented("PromptService.build"),
    history: () => notImplemented("PromptService.history"),
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
 * Build the set of host services. When a database is provided, Project,
 * Asset, and Graph services use real repositories. The event-service
 * unsubscribe trackers let the runtime tear down a plugin's subscriptions
 * on deactivate.
 */
export function buildHostServices(
  unsubscribeTrackers: Set<() => void>,
  db?: StudioDatabase | null,
): HostServices {
  return {
    project: db ? createProjectService(db) : stubService("ProjectService"),
    asset: db ? createAssetService(db) : stubService("AssetService"),
    graph: db ? createGraphService(db) : stubService("GraphService"),
    prompt: stubPrompt(),
    ai: stubAi(),
    file: stubFile(),
    media: stubMedia(),
    event: createEventService(unsubscribeTrackers),
    notification: createNotificationService(),
  };
}
