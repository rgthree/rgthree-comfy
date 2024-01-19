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
  timeout: number|null;
  // A caller property to store a defer timeout on.
  deferredTimeout?: number|null;
  deferredData?: any;
}

/**
 * Returns a new `Resolver` type that allows creating a "disconnected" `Promise` that can be
 * returned and resolved separately.
 */
export function getResolver<T>(timeout: number = 5000) : Resolver<T> {
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
    }
    resolver.resolve = (data: T) => {
      resolver.completed = true;
      resolver.resolved = true;
      resolve(data);
    }
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
  const arr = new Uint8Array(length / 2)
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join('');
}
