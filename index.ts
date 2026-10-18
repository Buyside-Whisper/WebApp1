function Log(target: object, name: string, descriptor: PropertyDescriptor) {
  console.log("Target:", target.constructor.name);
  console.log("Method name:", name);
  console.log("Original function exists:", descriptor.value);

  const original = descriptor.value;

  descriptor.value = function (...args: unknown[]) {
    console.log(`Calling ${name} with:`, args);
    return original.apply(this, args);
  };
}

class Calculator {
  @Log
  add(a: number, b: number) {
    return a + b;
  }
}

const calc = new Calculator();
console.log("Result:", calc.add(3, 5));
