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

  const state = new StateSingleton({ count: 0, otherField: 0 });

  let parentRenders = 0;
  let childRenders = 0;

  function Child({ count }: { count: number }) {
    childRenders++;
    return React.createElement("div", {}, `count: ${count}`);
  }

  function Parent() {
    parentRenders++;
    const count = useStateSingleton(state, (state) => state.count);
    return React.createElement(Child, { count });
  }

  const container = window.document.getElementById("root")!;

  act(() => {
    ReactDOM.render(React.createElement(Parent, {}), container);
  });

  t.equal(parentRenders, 1);
  t.equal(childRenders, 1);
  t.equal(container.innerHTML, "<div>count: 0</div>");

  act(() => {
    state.update((state) => {
      state.otherField++;
    });
  });

  t.equal(parentRenders, 1);
  t.equal(childRenders, 1);
  t.equal(container.innerHTML, "<div>count: 0</div>");

  act(() => {
    state.update((state) => {
      state.count = state.count;
    });
  });

  t.equal(parentRenders, 1);
  t.equal(childRenders, 1);
  t.equal(container.innerHTML, "<div>count: 0</div>");

  act(() => {
    state.update((state) => {
      state.count++;
    });
  });

  t.equal(parentRenders, 3);
  t.equal(childRenders, 2);
  t.equal(container.innerHTML, "<div>count: 1</div>");

  act(() => {
    ReactDOM.render(
      React.createElement(Parent, { prop: "new value" }),
      container
    );
  });

  t.equal(parentRenders, 4);
  t.equal(childRenders, 3);
  t.equal(container.innerHTML, "<div>count: 1</div>");
});
