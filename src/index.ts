import { Draft, produce } from "immer";
import { useEffect, useState } from "react";
import invariant from "tiny-invariant";
import { DeepReadonly } from "utility-types";

export interface StateSingletonListener<TState> {
  (state: DeepReadonly<TState>): void;
}

export type StateType<TStateSingleton> = TStateSingleton extends StateSingleton<
  infer TState
>
  ? TState
  : never;

export class StateSingleton<TState> {
  private listeners: Set<StateSingletonListener<TState>> = new Set();

  constructor(private state: TState) {}

  getState(): DeepReadonly<TState> {
    return this.state as DeepReadonly<TState>;
  }

  listen(listener: StateSingletonListener<TState>) {
    invariant(
      !this.listeners.has(listener),
      "This listener was already added to this StateSingleton."
    );
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(cb: (state: Draft<TState>) => void) {
    const prevState = this.state;
    this.state = produce(prevState, cb);

    if (this.state !== prevState) {
      for (let listener of this.listeners) {
        (listener as StateSingletonListener<TState>)(
          this.state as DeepReadonly<TState>
        );
      }
    }
  }
}

export interface SelectorFn<TReadonlyState, TSelection> {
  (state: TReadonlyState): TSelection;
}

export const defaultSelector: SelectorFn<any, any> = (state: any) => state;

export function useStateSingleton<TState, TSelection = DeepReadonly<TState>>(
  stateSingleton: StateSingleton<TState>,
  selector: SelectorFn<DeepReadonly<TState>, TSelection> = defaultSelector
): TSelection {
  const [currentValue, setCurrentValue] = useState(() =>
    selector(stateSingleton.getState())
  );

  useEffect(() => {
    setCurrentValue(selector(stateSingleton.getState()));
    return stateSingleton.listen((nextState) => {
      setCurrentValue(selector(nextState));
    });
  }, [stateSingleton, selector]);

  return currentValue;
}
