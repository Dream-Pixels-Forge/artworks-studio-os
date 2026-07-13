/**
 * Node-graph execution IPC.
 *
 * Wires the GraphExecutor to the renderer: a `node:run` channel kicks off a
 * graph run, execution events stream back over `node:execution:event`
 * (mirroring the `ai:stream` pattern), and `node:cancel` aborts an in-flight
 * run. Run history is queryable via `node:listRuns`.
 *
 * Registered from main/index.ts alongside registerProductionIpc. Takes the
 * same `db` + `apiKeyService` pair so the executor resolves keys through the
 * same single source of truth as the AI gateway.
 */
import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { createLogger } from "@main/core/logger.js";
import { eventBus } from "@main/core/event-bus.js";
import type { StudioDatabase } from "@main/database/db.js";
import type { ApiKeyService } from "@main/services/api-key-service.js";
import { NodeWorkflowRepository } from "@main/database/repositories/node-workflow-repository.js";
import { NodeRunRepository } from "@main/database/repositories/node-run-repository.js";
import { executeGraphWithReview, type ExecNode, type ExecEdge } from "./graph-executor.js";
import type { GraphRunStatus, NodeExecutionEvent } from "@shared/production/node-types.js";

/** The terminal statuses a run can finish in (excludes transient states). */
type TerminalRunStatus = "completed" | "failed" | "cancelled" | "awaiting-review";

/** Returns true if the status is a terminal one the finished event accepts. */
function isTerminal(status: GraphRunStatus): status is TerminalRunStatus {
  return status === "completed" || status === "failed" || status === "cancelled" || status === "awaiting-review";
}

const log = createLogger("node-execution-ipc");

/**
 * Emit a bus event wrapped in try/catch — the synchronous event bus has no
 * per-handler error isolation, so a throwing listener would otherwise abort
 * the emit loop and propagate to the executor. Node-run bookkeeping must
 * never be broken by a misbehaving event subscriber (e.g. a plugin).
 */
function safeEmit(type: "node:execution:started" | "node:execution:finished", payload: Record<string, unknown>): void {
  try {
    // Cast: the bus's generics infer the payload from `type`; callers above
    // already guarantee shape via the TerminalRunStatus type guard.
    eventBus.emit(type as never, payload as never);
  } catch (err) {
    log.error("event subscriber threw during node run", { type, err });
  }
}

/** Active runs keyed by runId, so node:cancel can abort a graph mid-flight. */
const activeRuns = new Map<string, AbortController>();

export function registerNodeExecutionIpc(
  db: StudioDatabase,
  apiKeyService: ApiKeyService,
): void {
  const nodeWorkflowRepo = new NodeWorkflowRepository(db);
  const runRepo = new NodeRunRepository(db);

  // --- node:run — kick off a graph execution -------------------------------
  ipcMain.handle(
    "node:run",
    async (e: IpcMainInvokeEvent, workflowUuid: string): Promise<{ runId: string } | { error: string }> => {
      const workflow = nodeWorkflowRepo.findByUuid(workflowUuid);
      if (!workflow) {
        return { error: `Workflow ${workflowUuid} not found.` };
      }

      // Parse the stored JSON graph (React Flow nodes/edges) into the
      // engine-local shapes. Malformed JSON is treated as an empty graph.
      let nodes: ExecNode[];
      let edges: ExecEdge[];
      try {
        nodes = (JSON.parse(workflow.nodes) as ExecNode[]).map((n) => ({
          id: n.id,
          data: { nodeKind: n.data?.nodeKind, config: n.data?.config },
        }));
        edges = JSON.parse(workflow.edges) as ExecEdge[];
      } catch (err) {
        const msg = `Failed to parse graph: ${err instanceof Error ? err.message : String(err)}`;
        log.error("node:run parse failed", { workflowUuid, error: msg });
        return { error: msg };
      }

      if (nodes.length === 0) {
        return { error: "Workflow has no nodes to run." };
      }

      const run = runRepo.createRun(workflowUuid);
      const controller = new AbortController();
      activeRuns.set(run.runId, controller);

      log.info("node run started", { runId: run.runId, workflowUuid, nodeCount: nodes.length });
      safeEmit("node:execution:started", { runId: run.runId, workflowUuid });

      // Forward execution events to the renderer AND persist them as steps.
      const onEvent = (event: NodeExecutionEvent): void => {
        try {
          persistEvent(runRepo, run.runId, event);
        } catch (err) {
          log.error("failed to persist run event", { runId: run.runId, err });
        }
        if (!e.sender.isDestroyed()) {
          e.sender.send("node:execution:event", run.runId, event);
        }
      };

      // Run the graph without blocking the handler return — the renderer
      // subscribes to the event stream and gets the terminal status there.
      void executeGraphWithReview(nodes, edges, run.runId, {
        getKey: (p) => apiKeyService.getKey(p),
        signal: controller.signal,
        onEvent,
      })
        .then((result) => {
          runRepo.updateRunStatus(run.runId, result.status, result.error);
          if (isTerminal(result.status)) {
            safeEmit("node:execution:finished", {
              runId: run.runId,
              workflowUuid,
              status: result.status,
              error: result.error,
            });
          }
          log.info("node run finished", { runId: run.runId, status: result.status });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          runRepo.updateRunStatus(run.runId, "failed", msg);
          safeEmit("node:execution:finished", {
            runId: run.runId,
            workflowUuid,
            status: "failed",
            error: msg,
          });
          log.error("node run failed", { runId: run.runId, error: msg });
        })
        .finally(() => {
          activeRuns.delete(run.runId);
        });

      return { runId: run.runId };
    },
  );

  // --- node:cancel — abort an in-flight run --------------------------------
  ipcMain.handle("node:cancel", (_e, runId: string): boolean => {
    const controller = activeRuns.get(runId);
    if (!controller) return false;
    controller.abort();
    log.info("node run cancelled", { runId });
    return true;
  });

  // --- node:listRuns — recent run history for a workflow -------------------
  ipcMain.handle("node:listRuns", (_e, workflowUuid: string) =>
    runRepo.listRuns(workflowUuid),
  );

  // --- node:getRun — a single run with its step history --------------------
  ipcMain.handle("node:getRun", (_e, runId: string) =>
    runRepo.getRunWithSteps(runId),
  );
}

/**
 * Translate an execution event into a step-row write. Called from the
 * onEvent callback so the run history is populated as the graph executes.
 */
function persistEvent(
  repo: NodeRunRepository,
  runId: string,
  event: NodeExecutionEvent,
): void {
  switch (event.type) {
    case "node:started":
      repo.upsertStep(runId, event.nodeId, event.nodeKind);
      break;
    case "node:completed":
      repo.updateStep(runId, event.nodeId, {
        status: "completed",
        outputJson: JSON.stringify(event.output ?? null),
      });
      break;
    case "node:failed":
      repo.updateStep(runId, event.nodeId, {
        status: "failed",
        error: event.error,
      });
      break;
    case "node:skipped":
      repo.updateStep(runId, event.nodeId, {
        status: "skipped",
        error: event.reason,
      });
      break;
    // run:started / run:completed / run:failed / run:cancelled are run-level,
    // not per-node — handled via updateRunStatus in the caller.
  }
}
