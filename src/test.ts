import test from "tape";
import { Draft } from "immer";
import { Store } from "./index";

enum VisibilityFilter {
  SHOW_ALL = "SHOW_ALL",
  SHOW_COMPLETED = "SHOW_COMPLETED",
  SHOW_ACTIVE = "SHOW_ACTIVE"
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

function addTodo(state: Draft<TodoState>, text: string) {
  state.todos.push({
    id: (state.nextTodoId++).toString(),
    text,
    completed: false
  });
}

function setVisibilityFilter(
  state: Draft<TodoState>,
  filter: VisibilityFilter
) {
  state.visibilityFilter = filter;
}

function toggleTodo(state: Draft<TodoState>, id: string) {
  for (let todo of state.todos) {
    if (todo.id === id) {
      todo.completed = !todo.completed;
    }
  }
}

function createTodoStore(): Store<TodoState> {
  return new Store({
    todos: [],
    visibilityFilter: VisibilityFilter.SHOW_ALL,
    nextTodoId: 0
  });
}

test("it works", t => {
  const store = createTodoStore();
  let changes = [];

  t.deepEqual(store.getState(), {
    todos: [],
    visibilityFilter: VisibilityFilter.SHOW_ALL,
    nextTodoId: 0
  });

  store.listen(state => {
    changes.push(state);
  });

  store.update(state => {
    addTodo(state, "foo");
    addTodo(state, "bar");
    addTodo(state, "baz");
  });

  t.equal(changes.length, 1);
  t.deepEqual(store.getState().todos, [
    { id: "0", text: "foo", completed: false },
    { id: "1", text: "bar", completed: false },
    { id: "2", text: "baz", completed: false }
  ]);

  store.update(state => {
    toggleTodo(state, "1");
  });

  t.deepEqual(store.getState().todos, [
    { id: "0", text: "foo", completed: false },
    { id: "1", text: "bar", completed: true },
    { id: "2", text: "baz", completed: false }
  ]);

  t.end();
});
