import { Draft, produce } from "immer";
import { useState, useEffect, useRef } from "react";
import invariant from "invariant";
import { DeepReadonly } from "utility-types";

export interface StoreListener<TState> {
  (state: DeepReadonly<TState>): void;
}

export type StateType<TStore> = TStore extends Store<infer TState>
  ? TState
  : never;

export class Store<TState> {
  // Setting this to StoreListener<T> confused the type inferencer
  // so we go with unknown instead.
  private listeners: Set<unknown> = new Set();

  constructor(private state: TState) {}

  getState(): DeepReadonly<TState> {
    return this.state as DeepReadonly<TState>;
  }

  listen(listener: StoreListener<TState>) {
    invariant(
      !this.listeners.has(listener),
      "This listener was already added to this Store."
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
        (listener as StoreListener<TState>)(this.state as DeepReadonly<TState>);
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

export function useStore<TState, TSelection = DeepReadonly<TState>>(
  store: Store<TState>,
  selector: SelectorFn<DeepReadonly<TState>, TSelection> = defaultSelector,
  equalityFn: EqualityFn<TSelection> = defaultEquality
): TSelection {
  const [value, setValue] = useState(() => selector(store.getState()));

  const valueRef = useRef<TSelection | null>(null);
  valueRef.current = value;

  const setValueRef = useRef<typeof setValue | null>(null);
  setValueRef.current = setValue;

  const selectorRef = useRef<SelectorFn<
    DeepReadonly<TState>,
    TSelection
  > | null>(null);
  selectorRef.current = selector;

  const equalityFnRef = useRef<EqualityFn<TSelection> | null>(null);
  equalityFnRef.current = equalityFn;

  useEffect(() => {
    return store.listen(nextState => {
      const value = valueRef.current!;
      const setValue = setValueRef.current!;
      const selector = selectorRef.current!;
      const equalityFn = equalityFnRef.current!;

      const nextValue = selector(nextState);
      if (!equalityFn(nextValue, value)) {
        setValue(nextValue);
      }
    });
  }, [store]);

  return value;
}
