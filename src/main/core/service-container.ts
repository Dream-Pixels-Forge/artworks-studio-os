/**
 * Service container (dependency injection).
 *
 * A minimal registry: modules register service factories keyed by an
 * interface token, consumers resolve them by the same token. This keeps
 * modules decoupled — they depend on contracts, not implementations.
 */

type Factory<T> = () => T;

class ServiceContainer {
  private factories = new Map<symbol, Factory<unknown>>();
  private instances = new Map<symbol, unknown>();

  register<T>(token: ServiceToken<T>, factory: Factory<T>): void {
    this.factories.set(token.key, factory as Factory<unknown>);
  }

  resolve<T>(token: ServiceToken<T>): T {
    const cached = this.instances.get(token.key);
    if (cached !== undefined) return cached as T;

    const factory = this.factories.get(token.key);
    if (!factory) {
      throw new Error(`No service registered for token "${token.description}".`);
    }
    const instance = factory();
    this.instances.set(token.key, instance);
    return instance as T;
  }

  /** Clear all registrations and cached instances. For tests. */
  reset(): void {
    this.factories.clear();
    this.instances.clear();
  }
}

export interface ServiceToken<T> {
  readonly key: symbol;
  readonly description: string;
  /** Phantom type marker — enforces type-safety at call sites only. */
  readonly _type?: T;
}

export function token<T>(description: string): ServiceToken<T> {
  return { key: Symbol(description), description };
}

export const container = new ServiceContainer();
