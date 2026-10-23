function xxx() {
  this.func = () => {
    console.log("hi");
  };
}

let something1 = xxx.prototype.func;
let something2 = xxx.prototype.func;

console.log(something1 == something2);
