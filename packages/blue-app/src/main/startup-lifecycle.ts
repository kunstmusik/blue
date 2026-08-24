export interface StartupStage {
  readonly name: string;
  readonly start: () => void | Promise<void>;
  readonly rollback?: () => void | Promise<void>;
  /** Process-lifetime work is recorded for diagnostics but has no disposer. */
  readonly irreversible?: boolean;
}

export interface StartupLifecycle {
  start(): Promise<void>;
  rollbackFailedStartup(): Promise<void>;
  startedStageNames(): readonly string[];
}

/**
 * Runs startup stages in order. This stack is deliberately only for failed
 * startup; normal application shutdown keeps its separately documented order.
 */
export function createStartupLifecycle(stages: readonly StartupStage[]): StartupLifecycle {
  let completed: StartupStage[] = [];
  let started = false;

  return {
    async start() {
      if (started) return;
      started = true;
      completed = [];
      for (const stage of stages) {
        try {
          const result = stage.start();
          if (result) {
            await result;
          }
          completed.push(stage);
        } catch (error) {
          // The stage owns its own partial transaction. Only previously
          // completed stages are unwound by this composition-level stack.
          try {
            await this.rollbackFailedStartup();
          } finally {
            started = false;
          }
          throw error;
        }
      }
    },

    async rollbackFailedStartup() {
      const rollbackStages = completed.slice().reverse();
      completed = [];
      for (const stage of rollbackStages) {
        if (!stage.rollback || stage.irreversible) continue;
        try {
          await stage.rollback();
        } catch (error) {
          // Keep unwinding and preserve the initiating startup error at the
          // caller. Cleanup diagnostics are useful but not replacement errors.
          console.error(`[startup] Failed to roll back ${stage.name}:`, error);
        }
      }
    },

    startedStageNames() {
      return completed.map((stage) => stage.name);
    },
  };
}

export async function runStartupStages(stages: readonly StartupStage[]): Promise<void> {
  await createStartupLifecycle(stages).start();
}
