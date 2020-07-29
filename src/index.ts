import { Draft, produce } from "immer";
import { useEffect, useRef, useMemo } from "react";
import invariant from "tiny-invariant";
import { DeepReadonly } from "utility-types";
import useForceUpdate from "use-force-update";

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

function useRefOf<T>(value: T) {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export function useStateSingleton<TState, TSelection = DeepReadonly<TState>>(
  stateSingleton: StateSingleton<TState>,
  selector: SelectorFn<DeepReadonly<TState>, TSelection> = defaultSelector,
  equalityFn: EqualityFn<TSelection> = defaultEquality
): TSelection {
  const forceUpdate = useForceUpdate();
  const value = useMemo(() => selector(stateSingleton.getState()), [
    selector,
    stateSingleton.getState(),
  ]);
  const valueRef = useRefOf(value);
  const selectorRef = useRefOf(selector);
  const equalityFnRef = useRefOf(equalityFn);

  useEffect(() => {
    return stateSingleton.listen((nextState) => {
      const nextValue = selectorRef.current!(nextState);
      if (!equalityFnRef.current!(valueRef.current!, nextValue)) {
        forceUpdate();
      }
    });
  }, [stateSingleton]);

  return value;
}
