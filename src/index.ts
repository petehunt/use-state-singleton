import { Draft, produce } from "immer";
import { useState, useEffect } from "react";
import invariant from "invariant";

export interface StoreListener<T> {
  (state: T): void;
}

export class Store<T> {
  // Setting this to StoreListener<T> confused the type inferencer
  // so we go with unknown instead.
  private listeners: Set<unknown> = new Set();

  constructor(private state: T) {}

  getState() {
    return this.state;
  }

  listen(listener: StoreListener<T>) {
    invariant(
      !this.listeners.has(listener),
      "This listener was already added to this Store."
    );
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(cb: (state: Draft<T>) => void) {
    this.state = produce(this.state, cb);
    for (let listener of this.listeners) {
      (listener as StoreListener<T>)(this.state);
    }
  }
}

export function defaultSelector(state: any) {
  return state;
}

export function defaultEquality(left: any, right: any) {
  return left === right;
}

export function useStore<T, S = T>(
  store: Store<T>,
  selector: (state: T) => S = defaultSelector,
  equalityFn: (prev: S, next: S) => boolean = defaultEquality
): S {
  const [value, setValue] = useState(() => selector(store.getState()));

  useEffect(() => {
    function cb(nextState: T) {
      const nextValue = selector(nextState);
      if (!equalityFn(nextValue, value)) {
        setValue(nextValue);
      }
    }
    return store.listen(cb);
  }, [store, selector, equalityFn]);

  return value;
}
