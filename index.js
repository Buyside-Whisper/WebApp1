class User {
  sayHello() {
    console.log("Hello!");
  }
}

const original = User.prototype.sayHello;

User.prototype.sayHello = function () {
  console.log("Method called!");
  original.call(this);
};

const user = new User();
user.sayHello();
