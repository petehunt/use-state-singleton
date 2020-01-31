import { Draft, produce } from "immer";
import { useState, useEffect, useRef } from "react";
import invariant from "invariant";
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
  // Setting this to StateSingletonListener<T> confused the type inferencer
  // so we go with unknown instead.
  private listeners: Set<unknown> = new Set();

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

export interface EqualityFn<TSelection> {
  (prev: TSelection, next: TSelection): boolean;
}

export const defaultSelector: SelectorFn<any, any> = (state: any) => state;
export const defaultEquality: EqualityFn<any> = (prev: any, next: any) =>
  prev === next;

export function useStateSingleton<TState, TSelection = DeepReadonly<TState>>(
  stateSingleton: StateSingleton<TState>,
  selector: SelectorFn<DeepReadonly<TState>, TSelection> = defaultSelector,
  equalityFn: EqualityFn<TSelection> = defaultEquality
): TSelection {
  const [value, setValue] = useState(() => selector(stateSingleton.getState()));

  const selectorRef = useRef<SelectorFn<
    DeepReadonly<TState>,
    TSelection
  > | null>(null);
  selectorRef.current = selector;

  const equalityFnRef = useRef<EqualityFn<TSelection> | null>(null);
  equalityFnRef.current = equalityFn;

  useEffect(() => {
    return stateSingleton.listen(nextState => {
      setValue(value => {
        const selector = selectorRef.current!;
        const equalityFn = equalityFnRef.current!;
        const nextValue = selector(nextState);
        if (!equalityFn(nextValue, value)) {
          return nextValue;
        }
        return value;
      });
    });
  }, [stateSingleton]);

  return value;
}
