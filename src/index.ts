import { Draft, produce } from "immer";
import { useState, useEffect, useRef } from "react";
import invariant from "invariant";

export interface StoreListener<TState> {
  (state: TState): void;
}

export type StateType<TStore> = TStore extends Store<infer TState>
  ? TState
  : never;

export class Store<TState> {
  // Setting this to StoreListener<T> confused the type inferencer
  // so we go with unknown instead.
  private listeners: Set<unknown> = new Set();

  constructor(private state: TState) {}

  getState() {
    return this.state;
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
        (listener as StoreListener<TState>)(this.state);
      }
    }
  }
}

export interface SelectorFn<TState, TSelection> {
  (state: TState): TSelection;
}

export interface EqualityFn<TSelection> {
  (prev: TSelection, next: TSelection): boolean;
}

export const defaultSelector: SelectorFn<any, any> = (state: any) => state;
export const defaultEquality: EqualityFn<any> = (prev: any, next: any) =>
  prev === next;

export function useStore<TState, TSelection = TState>(
  store: Store<TState>,
  selector: SelectorFn<TState, TSelection> = defaultSelector,
  equalityFn: EqualityFn<TSelection> = defaultEquality
): TSelection {
  const [value, setValue] = useState(() => selector(store.getState()));

  const valueRef = useRef<TSelection | null>(null);
  valueRef.current = value;

  const setValueRef = useRef<typeof setValue | null>(null);
  setValueRef.current = setValue;

  const selectorRef = useRef<SelectorFn<TState, TSelection> | null>(null);
  selectorRef.current = selector;

  const equalityFnRef = useRef<EqualityFn<TSelection> | null>(null);
  equalityFnRef.current = equalityFn;

  useEffect(() => {
    function cb(nextState: TState) {
      const value = valueRef.current!;
      const setValue = setValueRef.current!;
      const selector = selectorRef.current!;
      const equalityFn = equalityFnRef.current!;

      const nextValue = selector(nextState);
      if (!equalityFn(nextValue, value)) {
        setValue(nextValue);
      }
    }
    return store.listen(cb);
  }, [store]);

  return value;
}
