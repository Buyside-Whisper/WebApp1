class XXX {
  yyy1;
  yyy2;
  constructor(yyy1: string, yyy2: string) {
    this.yyy1 = yyy1;
    this.yyy2 = yyy2;
  }
  var1 = 1;
  var2 = 2;

  func1() {
    return this.var1;
  }

  func2() {
    return this.var2;
  }
}

let something = new XXX("xxx1", "xxx2");

console.log(something);
