/**
 * @fileoverview
 * A bunch of shared utils that can be used in ComfyUI, as well as in any single-HTML pages.
 */

export type Resolver<T> = {
  id: string;
  completed: boolean;
  resolved: boolean;
  rejected: boolean;
  promise: Promise<T>;
  resolve: (data: T) => void;
  reject: (e?: Error) => void;
  timeout: number | null;
  deferment?: {data?: any, timeout?: number|null, signal?: string};
};

/**
 * Returns a new `Resolver` type that allows creating a "disconnected" `Promise` that can be
 * returned and resolved separately.
 */
export function getResolver<T>(timeout: number = 5000): Resolver<T> {
  const resolver: Partial<Resolver<T>> = {};
  resolver.id = generateId(8);
  resolver.completed = false;
  resolver.resolved = false;
  resolver.rejected = false;
  resolver.promise = new Promise((resolve, reject) => {
    resolver.reject = (e?: Error) => {
      resolver.completed = true;
      resolver.rejected = true;
      reject(e);
    };
    resolver.resolve = (data: T) => {
      resolver.completed = true;
      resolver.resolved = true;
      resolve(data);
    };
  });
  resolver.timeout = setTimeout(() => {
    if (!resolver.completed) {
      resolver.reject!();
    }
  }, timeout);
  return resolver as Resolver<T>;
}

/** The WeakMap for debounced functions. */
const DEBOUNCE_FN_TO_PROMISE: WeakMap<Function, Promise<void>> = new WeakMap();

/**
 * Debounces a function call so it is only called once in the initially provided ms even if asked
 * to be called multiple times within that period.
 */
export function debounce(fn: Function, ms = 64) {
  if (!DEBOUNCE_FN_TO_PROMISE.get(fn)) {
    DEBOUNCE_FN_TO_PROMISE.set(
      fn,
      wait(ms).then(() => {
        DEBOUNCE_FN_TO_PROMISE.delete(fn);
        fn();
      }),
    );
  }
  return DEBOUNCE_FN_TO_PROMISE.get(fn);
}

/** Waits a certain number of ms, as a `Promise.` */
export function wait(ms = 16): Promise<void> {
  // Special logic, if we're waiting 16ms, then trigger on next frame.
  if (ms === 16) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function dec2hex(dec: number) {
  return dec.toString(16).padStart(2, "0");
}

/** Generates an unique id of a specific length. */
export function generateId(length: number) {
  const arr = new Uint8Array(length / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join("");
}

/**
 * Returns the deep value of an object given a dot-delimited key.
 */
export function getObjectValue(obj: any, objKey: string, def?: any) {
  if (!obj || !objKey) return def;

  const keys = objKey.split(".");
  const key = keys.shift()!;
  const found = obj[key];
  if (keys.length) {
    return getObjectValue(found, keys.join("."), def);
  }
  return found;
}

/**
 * Sets the deep value of an object given a dot-delimited key.
 *
 * By default, missing objects will be created while settng the path.  If `createMissingObjects` is
 * set to false, then the setting will be abandoned if the key path is missing an intermediate
 * value. For example:
 *
 *   setObjectValue({a: {z: false}}, 'a.b.c', true); // {a: {z: false, b: {c: true } } }
 *   setObjectValue({a: {z: false}}, 'a.b.c', true, false); // {a: {z: false}}
 *
 */
export function setObjectValue(obj: any, objKey: string, value: any, createMissingObjects = true) {
  if (!obj || !objKey) return obj;

  const keys = objKey.split(".");
  const key = keys.shift()!;
  if (obj[key] === undefined) {
    if (!createMissingObjects) {
      return;
    }
    obj[key] = {};
  }
  if (!keys.length) {
    obj[key] = value;
  } else {
    if (typeof obj[key] != "object") {
      obj[key] = {};
    }
    setObjectValue(obj[key], keys.join("."), value, createMissingObjects);
  }
  return obj;
}

/**
 * Moves an item in an array (by item or its index) to another index.
 */
export function moveArrayItem<T>(arr: T[], itemOrFrom: T | number, to: number) {
  const from = typeof itemOrFrom === "number" ? itemOrFrom : arr.indexOf(itemOrFrom);
  arr.splice(to, 0, arr.splice(from, 1)[0]!);
}

/**
 * Moves an item in an array (by item or its index) to another index.
 */
export function removeArrayItem<T>(arr: T[], itemOrIndex: T | number) {
  const index = typeof itemOrIndex === "number" ? itemOrIndex : arr.indexOf(itemOrIndex);
  arr.splice(index, 1);
}

/**
 * Injects CSS into the page with a promise when complete.
 */
export function injectCss(href: string): Promise<void> {
  if (document.querySelector(`link[href^="${href}"]`)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("type", "text/css");
    const timeout = setTimeout(resolve, 1000);
    link.addEventListener("load", (e) => {
      clearInterval(timeout);
      resolve();
    });
    link.href = href;
    document.head.appendChild(link);
  });
}

/**
 * Calls `Object.defineProperty` with special care around getters and setters to call out to a
 * parent getter or setter (like a super.set call)   to ensure any side effects up the chain
 * are still invoked.
 */
export function defineProperty(instance: any, property: string, desc: PropertyDescriptor) {
  const existingDesc = Object.getOwnPropertyDescriptor(instance, property);
  if (existingDesc?.configurable === false) {
    throw new Error(`Error: rgthree-comfy cannot define un-configurable property "${property}"`);
  }

  if (existingDesc?.get && desc.get) {
    const descGet = desc.get;
    desc.get = () => {
      existingDesc.get!.apply(instance, []);
      return descGet!.apply(instance, []);
    };
  }
  if (existingDesc?.set && desc.set) {
    const descSet = desc.set;
    desc.set = (v: any) => {
      existingDesc.set!.apply(instance, [v]);
      return descSet!.apply(instance, [v]);
    };
  }

  desc.enumerable = desc.enumerable ?? existingDesc?.enumerable ?? true;
  desc.configurable = desc.configurable ?? existingDesc?.configurable ?? true;
  if (!desc.get && !desc.set) {
    desc.writable = desc.writable ?? existingDesc?.writable ?? true;
  }
  return Object.defineProperty(instance, property, desc);
}
