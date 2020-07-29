import test from "tape-async";
import { StateSingleton, useStateSingleton, StateType } from "./index";
import { JSDOM } from "jsdom";
import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";

enum VisibilityFilter {
  SHOW_ALL,
  SHOW_COMPLETED,
  SHOW_ACTIVE,
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoState {
  todos: Todo[];
  visibilityFilter: VisibilityFilter;
  nextTodoId: number;
}

function addTodo(state: TodoState, text: string) {
  state.todos.push({
    id: (state.nextTodoId++).toString(),
    text,
    completed: false,
  });
}

function setVisibilityFilter(state: TodoState, filter: VisibilityFilter) {
  state.visibilityFilter = filter;
}

function toggleTodo(state: TodoState, id: string) {
  for (let todo of state.todos) {
    if (todo.id === id) {
      todo.completed = !todo.completed;
    }
  }
}

test("it works", async (t) => {
  const stateSingleton = new StateSingleton({
    todos: [],
    visibilityFilter: VisibilityFilter.SHOW_ALL,
    nextTodoId: 0,
  });

  let changes = [];

  t.deepEqual(stateSingleton.getState(), {
    todos: [],
    visibilityFilter: VisibilityFilter.SHOW_ALL,
    nextTodoId: 0,
  });

  stateSingleton.listen((state) => {
    changes.push(state);
  });

  stateSingleton.update((state) => {
    addTodo(state, "foo");
    addTodo(state, "bar");
    addTodo(state, "baz");
  });

  t.equal(changes.length, 1);
  t.deepEqual(stateSingleton.getState().todos, [
    { id: "0", text: "foo", completed: false },
    { id: "1", text: "bar", completed: false },
    { id: "2", text: "baz", completed: false },
  ]);

  stateSingleton.update((state) => {
    toggleTodo(state, "1");
  });

  t.deepEqual(stateSingleton.getState().todos, [
    { id: "0", text: "foo", completed: false },
    { id: "1", text: "bar", completed: true },
    { id: "2", text: "baz", completed: false },
  ]);
});

test("react hook", async (t) => {
  const { window } = new JSDOM(
    `<!DOCTYPE html><html><body><div id="root"></div></body></html>`
  );

  (global as any).window = window;

  const counterSingleton = new StateSingleton({ count: 0, otherField: 0 });
  let numListenCalls = 0;
  let numChangeCallbacks = 0;
  let numRenders = 0;
  let numSelects = 0;
  let numEqualityChecks = 0;

  function monkeypatchSingleton(singleton: typeof counterSingleton) {
    const prevListen = singleton.listen;

    // monkeypatches needed for testing
    singleton.listen = (cb) => {
      numListenCalls++;
      return prevListen.call(singleton, (value) => {
        numChangeCallbacks++;
        return cb(value);
      });
    };
  }

  monkeypatchSingleton(counterSingleton);

  function selector1(state: StateType<typeof counterSingleton>) {
    numSelects++;
    return state.count;
  }

  function selector2(state: StateType<typeof counterSingleton>) {
    numSelects++;
    return state.count;
  }

  function equality1(a: any, b: any) {
    numEqualityChecks++;
    return a === b;
  }

  function equality2(a: any, b: any) {
    numEqualityChecks++;
    return a === b;
  }

  function MyComponent({
    singleton,
    selector,
    equalityFn,
  }: {
    singleton: typeof counterSingleton;
    selector: typeof selector1;
    equalityFn: typeof equality1;
  }) {
    numRenders++;
    const count = useStateSingleton(singleton, selector, equalityFn);

    return React.createElement("div", null, count);
  }

  const container = window.document.getElementById("root")!;

  function rerender(props: Parameters<typeof MyComponent>[0]) {
    act(() => {
      ReactDOM.render(React.createElement(MyComponent, props), container);
    });
  }

  rerender({
    selector: selector1,
    equalityFn: equality1,
    singleton: counterSingleton,
  });
  t.equal(container.innerHTML, "<div>0</div>");
  t.equal(numListenCalls, 1);
  t.equal(numRenders, 1);
  t.equal(numChangeCallbacks, 0);
  t.equal(numEqualityChecks, 0);
  t.equal(numSelects, 1);

  // update a field that wasn't selected
  act(() => {
    counterSingleton.update((state) => {
      state.otherField++;
    });
  });

  t.equal(container.innerHTML, "<div>0</div>");
  t.equal(numListenCalls, 1);
  t.equal(numRenders, 1);
  t.equal(numChangeCallbacks, 1);
  t.equal(numEqualityChecks, 1);
  t.equal(numSelects, 2);

  // update a field that was selected
  act(() => {
    counterSingleton.update((state) => {
      state.count++;
    });
  });

  t.equal(container.innerHTML, "<div>1</div>");
  t.equal(numListenCalls, 1);
  t.equal(numRenders, 2);
  t.equal(numChangeCallbacks, 2);
  t.equal(numEqualityChecks, 2);
  t.equal(numSelects, 4);

  // rerender with same data
  rerender({
    selector: selector1,
    equalityFn: equality1,
    singleton: counterSingleton,
  });
  t.equal(container.innerHTML, "<div>1</div>");
  t.equal(numListenCalls, 1);
  t.equal(numRenders, 3);
  t.equal(numChangeCallbacks, 2);
  t.equal(numEqualityChecks, 2);
  t.equal(numSelects, 4);

  // rerender with new selector
  rerender({
    selector: selector2,
    equalityFn: equality1,
    singleton: counterSingleton,
  });
  t.equal(container.innerHTML, "<div>1</div>");
  t.equal(numListenCalls, 1);
  t.equal(numRenders, 4);
  t.equal(numChangeCallbacks, 2);
  t.equal(numEqualityChecks, 2);
  t.equal(numSelects, 5);

  // rerender with new equality
  rerender({
    selector: selector2,
    equalityFn: equality2,
    singleton: counterSingleton,
  });
  t.equal(container.innerHTML, "<div>1</div>");
  t.equal(numListenCalls, 1);
  t.equal(numRenders, 5);
  t.equal(numChangeCallbacks, 2);
  t.equal(numEqualityChecks, 2);
  t.equal(numSelects, 5);

  // rerender with new singleton
  const counterSingleton2 = new StateSingleton({ count: 0, otherField: 0 });
  monkeypatchSingleton(counterSingleton2);

  rerender({
    selector: selector2,
    equalityFn: equality2,
    singleton: counterSingleton2,
  });
  t.equal(container.innerHTML, "<div>0</div>");
  t.equal(numListenCalls, 2);
  t.equal(numRenders, 6);
  t.equal(numChangeCallbacks, 2);
  t.equal(numEqualityChecks, 2);
  t.equal(numSelects, 6);

  // old singleton does not update anything
  counterSingleton.update((state) => {
    state.count++;
  });
  t.equal(container.innerHTML, "<div>0</div>");
  t.equal(numListenCalls, 2);
  t.equal(numRenders, 6);
  t.equal(numChangeCallbacks, 2);
  t.equal(numEqualityChecks, 2);
  t.equal(numSelects, 6);

  // new singleton updates correctly
  act(() => {
    counterSingleton2.update((state) => {
      state.count++;
    });
  });

  t.equal(container.innerHTML, "<div>1</div>");
  t.equal(numListenCalls, 2);
  t.equal(numRenders, 7);
  t.equal(numChangeCallbacks, 3);
  t.equal(numEqualityChecks, 3);
  t.equal(numSelects, 8);

  // equality function skips rendering.
  // also can receive a new equality function
  let equality3Calls = 0;
  const equality3 = () => {
    equality3Calls++;
    numEqualityChecks++;
    return true;
  };

  rerender({
    selector: selector2,
    equalityFn: equality3,
    singleton: counterSingleton2,
  });
  t.equal(container.innerHTML, "<div>1</div>");
  t.equal(numListenCalls, 2);
  t.equal(numRenders, 8);
  t.equal(numChangeCallbacks, 3);
  t.equal(numEqualityChecks, 3);
  t.equal(numSelects, 8);
  t.equal(equality3Calls, 0);

  act(() => {
    counterSingleton2.update((state) => {
      state.count++;
    });
  });
  t.equal(container.innerHTML, "<div>1</div>");
  t.equal(numListenCalls, 2);
  t.equal(numRenders, 8);
  t.equal(numChangeCallbacks, 4);
  t.equal(numEqualityChecks, 4);
  t.equal(numSelects, 9);
  t.equal(equality3Calls, 1);

  // reset to the old state for the next test
  rerender({
    selector: selector2,
    equalityFn: equality2,
    singleton: counterSingleton2,
  });
  t.equal(container.innerHTML, "<div>2</div>");
  t.equal(numListenCalls, 2);
  t.equal(numRenders, 9);
  t.equal(numChangeCallbacks, 4);
  t.equal(numEqualityChecks, 4);
  t.equal(numSelects, 10);

  // make sure we can receive a new select function
  const selector3 = () => {
    numSelects++;
    return 99;
  };

  rerender({
    selector: selector3,
    equalityFn: equality2,
    singleton: counterSingleton2,
  });
  t.equal(container.innerHTML, "<div>99</div>");
  t.equal(numListenCalls, 2);
  t.equal(numRenders, 10);
  t.equal(numChangeCallbacks, 4);
  t.equal(numEqualityChecks, 4);
  t.equal(numSelects, 11);

  // rerender with same props, no changes
  rerender({
    selector: selector3,
    equalityFn: equality2,
    singleton: counterSingleton2,
  });
  t.equal(container.innerHTML, "<div>99</div>");
  t.equal(numListenCalls, 2);
  t.equal(numRenders, 11);
  t.equal(numChangeCallbacks, 4);
  t.equal(numEqualityChecks, 4);
  t.equal(numSelects, 11);

  // trigger callback with no changes
  act(() => {
    counterSingleton2.update((state) => {
      state.count = state.count;
    });
  });

  t.equal(container.innerHTML, "<div>99</div>");
  t.equal(numListenCalls, 2);
  t.equal(numRenders, 11);
  t.equal(numChangeCallbacks, 4);
  t.equal(numEqualityChecks, 4);
  t.equal(numSelects, 11);
});
