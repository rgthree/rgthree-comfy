export function getResolver(timeout = 5000) {
    const resolver = {};
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
        resolver.resolve = (data) => {
            resolver.completed = true;
            resolver.resolved = true;
            resolve(data);
        };
    });
    resolver.timeout = setTimeout(() => {
        if (!resolver.completed) {
            resolver.reject();
        }
    }, timeout);
    return resolver;
}
export function wait(ms = 16, value) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(value);
        }, ms);
    });
}
function dec2hex(dec) {
    return dec.toString(16).padStart(2, "0");
}
export function generateId(length) {
    const arr = new Uint8Array(length / 2);
    crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join("");
}
export function getObjectValue(obj, objKey, def) {
    if (!obj || !objKey)
        return def;
    const keys = objKey.split(".");
    const key = keys.shift();
    const found = obj[key];
    if (keys.length) {
        return getObjectValue(found, keys.join("."), def);
    }
    return found;
}
export function setObjectValue(obj, objKey, value, createMissingObjects = true) {
    if (!obj || !objKey)
        return obj;
    const keys = objKey.split(".");
    const key = keys.shift();
    if (obj[key] === undefined) {
        if (!createMissingObjects) {
            return;
        }
        obj[key] = {};
    }
    if (!keys.length) {
        obj[key] = value;
    }
    else {
        if (typeof obj[key] != "object") {
            obj[key] = {};
        }
        setObjectValue(obj[key], keys.join("."), value, createMissingObjects);
    }
    return obj;
}
