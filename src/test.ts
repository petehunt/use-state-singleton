import test from "tape";
import { StateSingleton } from "./index";

enum VisibilityFilter {
  SHOW_ALL,
  SHOW_COMPLETED,
  SHOW_ACTIVE
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
    completed: false
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

test("it works", t => {
  const stateSingleton = new StateSingleton({
    todos: [],
    visibilityFilter: VisibilityFilter.SHOW_ALL,
    nextTodoId: 0
  });

  let changes = [];

  t.deepEqual(stateSingleton.getState(), {
    todos: [],
    visibilityFilter: VisibilityFilter.SHOW_ALL,
    nextTodoId: 0
  });

  stateSingleton.listen(state => {
    changes.push(state);
  });

  stateSingleton.update(state => {
    addTodo(state, "foo");
    addTodo(state, "bar");
    addTodo(state, "baz");
  });

  t.equal(changes.length, 1);
  t.deepEqual(stateSingleton.getState().todos, [
    { id: "0", text: "foo", completed: false },
    { id: "1", text: "bar", completed: false },
    { id: "2", text: "baz", completed: false }
  ]);

  stateSingleton.update(state => {
    toggleTodo(state, "1");
  });

  t.deepEqual(stateSingleton.getState().todos, [
    { id: "0", text: "foo", completed: false },
    { id: "1", text: "bar", completed: true },
    { id: "2", text: "baz", completed: false }
  ]);

  t.end();
});
