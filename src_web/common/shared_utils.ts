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
  reject: () => void;
  timeout: number | null;
  // A caller property to store a defer timeout on.
  deferredTimeout?: number | null;
  deferredData?: any;
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
    resolver.reject = () => {
      resolver.completed = true;
      resolver.rejected = true;
      reject();
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

/** Waits a certain number of ms, as a `Promise.` */
export function wait(ms = 16, value?: any) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value);
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
