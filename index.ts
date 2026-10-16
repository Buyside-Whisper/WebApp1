function getProperty<T, K extends keyof T>(object: T, key: K): T[K] {
  return object[key];
}

const user = { id: 1, nameX: "David", active: true };

const nameX = getProperty(user, "nameX");
const id = getProperty(user, "id");
const active = getProperty(user, "active");
