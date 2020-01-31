# use-state-singleton

`use-state-singleton` is yet another redux alternative. the goal is to eliminate action objects -- which are tedious to write and allocate garbage -- and replace them with plain old functions, while maintaining an immutable programming model familiar to redux users.

## todos

you can see the [redux todos example](https://github.com/reduxjs/redux/tree/master/examples/todos) ported to `use-state-singleton` below. compare how much code there is in the (vanilla js) redux version vs the (fully typed) `use-state-singleton` version!

```typescript
enum VisibilityFilter {
  SHOW_ALL
  SHOW_COMPLETED
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

const appStateSingleton = new StateSingleton({
  todos: [],
  visibilityFilter: VisibilityFilter.SHOW_ALL,
  nextTodoId: 0
});
```

just like redux, your app state is fully contained in a single data structure called a `StateSingleton`. you can have multiple `StateSingletons` in your app if you'd like (i.e. for different apps), but each one should describe a different part of your application. that is, it would be a good idea to have a single `Todos` `StateSingleton`, not an instance of `StateSingleton` for every item in the todo list.

under the hood, `use-state-singleton` uses `immer` to give you the usability of an imperative api with the performance benefits of immutability.

there's a react hook for reading from the state.

```tsx
function MyComponent() {
  // you can get the whole state, which will result in the component rerendering on every change...
  const state = useStateSingleton(appStateSingleton);
  // you can use a selector to get part of the state, which will only rerender the component when the
  // selected value changes
  const todos = useStateSingleton(appStateSingleton, state => state.todos);
  // you can also provide a custom comparator if you need it, though this should be rare.
  const todos = useStateSingleton(
    appStateSingleton,
    state => state.todos,
    myDeepEqualFn
  );

  // ... use the immutable todos array in your component ...
}
```

finally, if you want to update a `StateSingleton` -- usually as a result of an HTTP request, user event, or timer -- use the `update()` method:

```typescript
appStateSingleton.update(state => {
  // feel free to mutate state within these (synchronous) blocks
  addTodo(state, "foo");
});
```

## outside of react

you can use `update()` completely outside of react.

you can also read from the `StateSingleton` outside of react by using its `getState()` method. this can be useful when debugging in the app console, but you should generally avoid using this method. instead, if you are using a library other than react, you can use the `listen(cb)` method to subscribe to changes to the `StateSingleton` and react to them.

## recipe: data fetching

```typescript
const todoState = new StateSingleton({
  todos: [],
  loading: false,
  error: null,
  pendingRequests: 0
});

async function fetchTodoList() {
  let requestId = 0;

  todoState.update(state => {
    state.loading = true;
    requestId = ++state.pendingRequests;
  });

  try {
    const req = await fetch("/todos.json");
    const json = await req.json();

    todoState.update(state => {
      // make sure that if there are multiple requests in flight, we keep
      // the latest one.
      if (state.pendingRequests === requestId) {
        state.todos = json;
        state.loading = false;
      }
    });
  } catch (e) {
    todoState.update(state => {
      if (state.pendingRequests === requestId) {
        state.loading = false;
        state.error = e.toString();
      }
    });
  }
}
```

## recipe: storing state in react context

it's as easy as composing a few hooks together!

```tsx
const MyContext = React.createContext(new StateSingleton(...));

function MyComponent() {
  const singleton = useContext(MyContext);
  const state = useStateSingleton(singleton);
  // ... do something with state ...
}

React.render(<MyContext.Provider><MyComponent /></MyContext.Provider>, domElem);
```

## recipe: OOP-style data hiding

sometimes you may want to hide the internals of the state object from the react components with a facade. this helps you present a stable "view model" interface to your components. for many projects it's not needed but sometimes it can be useful. again, use composition -- create "reader" classes that wrap the state and create a corresponding react hook.

```typescript
class TodosReader {
  constructor(private todos: Todo[]) {}

  getTodoById(id: string) {
    return this.todos.find(todo => todo.id === id);
  }

  // ... some other methods ...
}

function useTodosReader() {
  return new TodosReader(useStateSingleton(todoState, state => state.todos));
}
```

## recipe: OOP-style mutation

you can create a similar interface as above for mutation -- though it can get out of hand quickly, so be careful!

```typescript
class TodoWriter {
  constructor(private todo: Todo) {}

  getId() {
    return this.todo.id;
  }

  toggleCompleted() {
    this.todo.completed = !this.todo.completed;
  }
}

class TodosWriter extends TodosReader {
  constructor(todos: Todo[]) {
    super(todos);
  }

  getTodoById(id: string) {
    return new TodoWriter(super.getTodoByid(id));
  }
}

function handleCheckboxToggled(id: string) {
  todoState.update(state => {
    const todoWriter = new TodoWriter(state);
    todoWriter.getTodoById(id).toggleCompleted();
  });
}
```

## recipe: typescript utilities

- you can refer to the type of your `StateSingleton` by using `typeof myStateSingleton`. this is just a handy typescript feature.
- you can refer to the type of your `StateSingleton`'s **state** by using `StateType<typeof myStateSingleton>`. this ships with `use-state-singleton`.
