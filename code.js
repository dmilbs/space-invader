let statusBar = document.getElementById("status")
statusBar.style.position = "absolute";
statusBar.style.width = "1020px";
statusBar.style.height = "80px";
statusBar.style.background = "red";

class Level {
  constructor(plan) {
    let rows = plan.trim().split("\n").map(l => [...l]);
    this.height = rows.length;
    this.width = rows[0].length;
    this.startActors = [];

    this.rows = rows.map((row, y) => {
      return row.map((ch, x) => {
        let type = levelChars[ch];
        if (typeof type == "string") return type;
        this.startActors.push(
          type.create(new Vec(x, y), ch));
        return "empty";
      });
    });

  }
}

class State {
  constructor(level, actors, status) {
    this.level = level;
    this.actors = actors;
    this.status = status;
  }

  static start(level) {
    return new State(level, level.startActors, "playing");
  }

  get player() {
    return this.actors.find(a => a.type == "player");
  }
}

class Vec {
  constructor(x, y){
    this.x = x;
    this.y = y;
  }
  plus(other) {
    return new Vec(this.x + other.x, this.y + other.y)
  }
  minus(other) {
    return new Vec(this.x - other.x, this.y - other.y)
  }
  times(factor) {
    return new Vec(this.x * factor, this.y * factor)
  }
}

var Player = class Player {
  constructor(pos, speed) {
    this.pos = pos;
    this.speed = speed;
  }

  get type() { return "player"; }

  static create(pos) {
    return new Player(pos.plus(new Vec(0.2, 0)),
                      new Vec(0, -3));
  }
}

Player.prototype.size = new Vec(0.6, 1);

var Laser = class Laser {
  constructor(pos, speed) {
    this.pos = pos;
    this.speed = speed;
  }

  get type() { return "laser"; }

  static create(pos, ch) {
    if (ch == "=") {
      return new Laser(pos, new Vec(2, 0));
    } else if (ch == "|") {
      return new Laser(pos, new Vec(0, 2));
    }
  }
}

Laser.prototype.size = new Vec(0.5, 0.5)

// TODO count coins
var Coin = class Coin {
  constructor(pos, basePos, wobble) {
    this.pos = pos;
    this.basePos = basePos;
    this.wobble = wobble;
  }

  get type() { return "coin"; }

  static create(pos) {
    let basePos = pos.plus(new Vec(0.2, 0.1));
    return new Coin(basePos, basePos,
                    Math.random() * Math.PI * 2);
  }
}

Coin.prototype.size = new Vec(0.6, 0.6);

var Mine = class Mine {
  constructor(pos) {
    this.pos = pos;
  }

  get type() {return "mine";}

  static create(pos) {
    let basePos = pos.plus(new Vec(0.2, 0.2));
    return new Mine(basePos);
  }
}
//TODO drawn in background once, with circular shape, when you touch you die.
Mine.prototype.size = new Vec(0.6, 0.6);

var levelChars = {
  ".": "empty", "$": "wall",
  "@": Player, "o": Coin,
  "=": Laser, "|": Laser, "#": "mine"
};

function elt(name, attrs, ...children) {
  let dom = document.createElement(name);
  for (let attr of Object.keys(attrs)) {
    dom.setAttribute(attr, attrs[attr]);
  }
  for (let child of children) {
    dom.appendChild(child);
  }
  return dom;
}

var DOMDisplay = class DOMDisplay {
  constructor(parent, level) {
    this.dom = elt("div", {class: "game"}, drawGrid(level));
    this.actorLayer = null;
    parent.appendChild(this.dom);
  }

  clear() { this.dom.remove(); }
}

var scale = 20;
// function drawLastRow(level, i) {
//   for level
// }
function drawGrid(level) {
  console.log(level.rows[0].length)
  return elt("table", {
    class: "background",
    style: `width: ${level.width * scale}px`
  }, ...level.rows.map(row =>
    elt("tr", {style: `height: ${scale}px`},
        ...row.map(type => elt("td", {class: type})))
  )
);
}

function drawActors(actors) {
  return elt("div", {}, ...actors.map(actor => {
    let rect = elt("div", {class: `actor ${actor.type}`});
    rect.style.width = `${actor.size.x * scale}px`;
    rect.style.height = `${actor.size.y * scale}px`;
    rect.style.left = `${actor.pos.x * scale}px`;
    rect.style.top = `${actor.pos.y * scale}px`;
    return rect;
  }));
}

DOMDisplay.prototype.syncState = function(state, time, scrollAmount) {

  if (this.actorLayer) this.actorLayer.remove();
  this.actorLayer = drawActors(state.actors);
  this.dom.appendChild(this.actorLayer);
  this.dom.className = `game ${state.status}`;
  this.scrollScreen(state, scrollAmount);

};

// TODO: make autoscroll ---MAYBE DONE
DOMDisplay.prototype.scrollScreen = function(state, scrollAmount) {
  let height = this.dom.clientHeight;
  let margin = height / 1.45;

  this.dom.scrollTop = 2500 + margin - scrollAmount


};

DOMDisplay.prototype.findTop = function() {
  let top = (this.dom.scrollTop + 20) / 20
  return top
}

DOMDisplay.prototype.findBottom = function() {
  let bottom =  (this.dom.scrollTop + this.dom.clientHeight - 50) / 20
  return bottom
}

Level.prototype.touches = function(pos, size, type) {
  var xStart = Math.floor(pos.x);
  var xEnd = Math.ceil(pos.x + size.x);
  var yStart = Math.floor(pos.y);
  var yEnd = Math.ceil(pos.y + size.y);

  for (var y = yStart; y < yEnd; y++) {
    for (var x = xStart; x < xEnd; x++) {
      let isOutside = x < 0 || x >= this.width ||
                      y < 0 || y >= this.height;
      let here = isOutside ? "wall" : this.rows[y][x];
      if (here == type) return true;
    }
  }
  return false;
};
//TODO make bottom and top barriers smooth
State.prototype.update = function(time, keys, display, scrollAmount) {
  let actors = this.actors
    .map(actor => actor.update(time, this, keys, display, scrollAmount));
  let newState = new State(this.level, actors, this.status);

  if (newState.status != "playing") return newState;

  let player = newState.player;
  if (player.pos.y < 27) newState.status = "won"
  if (this.level.touches(player.pos, player.size, "mine")) {
    return new State(this.level, actors, "playing");
  }

  for (let actor of actors) {
    if (actor != player && overlap(actor, player)) {
      newState = actor.collide(newState);
    }
  }
  return newState;
};

function overlap(actor1, actor2) {
  return actor1.pos.x + actor1.size.x > actor2.pos.x &&
         actor1.pos.x < actor2.pos.x + actor2.size.x &&
         actor1.pos.y + actor1.size.y > actor2.pos.y &&
         actor1.pos.y < actor2.pos.y + actor2.size.y;
}

Laser.prototype.collide = function(state) {
  return new State(state.level, state.actors, "lost");
};

Mine.prototype.collide = function(state) {
  return new State(state.level, state.actors, "lost");
}

Coin.prototype.collide = function(state) {
  let filtered = state.actors.filter(a => a != this);
  let status = state.status;
  return new State(state.level, filtered, status);
};

Laser.prototype.update = function(time, state) {
  let newPos = this.pos.plus(this.speed.times(time));
  if (!state.level.touches(newPos, this.size, "wall")) {
    return new Laser(newPos, this.speed, this.reset);
  } else {
    return new Laser(this.pos, this.speed.times(-1));
  }
};

var wobbleSpeed = 8, wobbleDist = 0.07;

Coin.prototype.update = function(time) {
  let wobble = this.wobble + time * wobbleSpeed;
  let wobblePos = Math.sin(wobble) * wobbleDist;
  return new Coin(this.basePos.plus(new Vec(0, wobblePos)),
                  this.basePos, wobble);
};

Mine.prototype.update = function(time) {
  return new Mine(this.pos)
}
var playerXSpeed = 7;

var playerUpSpeed = 5;
var playerDownSpeed = 4;

Player.prototype.update = function(time, state, keys, display, scrollAmount) {

  function needsToGoUp() {
    return !keys.ArrowUp && bottomDiff < 0 ? true : false
  }

  let xSpeed = 0;
  if (keys.ArrowLeft) xSpeed -= playerXSpeed;
  if (keys.ArrowRight) xSpeed += playerXSpeed;
  let pos = this.pos;
  let movedX = pos.plus(new Vec(xSpeed * time, 0));
  if (!state.level.touches(movedX, this.size, "wall")) {
    pos = movedX;
  }

  let ySpeed = 0;



  if (keys.ArrowUp) ySpeed -= playerUpSpeed
  if (keys.ArrowDown) ySpeed += playerDownSpeed;

  let movedY = pos.plus(new Vec(0, ySpeed * time));


  if (!state.level.touches(movedY, this.size, "wall")) {
    pos = movedY;
  }

  if (pos.y >= Math.floor(display.findBottom())) {
    if (!keys.ArrowDown) {
      pos.y -= 0.1;
    }
    else {
      pos.y -= 0.4;
    }
    keys.ArrowDown = false
  }
  if (pos.y <= Math.floor(display.findTop())) {
    if (!keys.ArrowUp) {
      pos.y += 0.132;
    }
    else {
      pos.y += 0.4
    }
  }

  return new Player(pos, new Vec(xSpeed, ySpeed));

};

function trackKeys(keys) {
  let down = Object.create(null);
  function track(event) {
    if (keys.includes(event.key)) {
      down[event.key] = event.type == "keydown";
      event.preventDefault();
    }
  }
  window.addEventListener("keydown", track);
  window.addEventListener("keyup", track);
  return down;
}
var arrowKeys =
  trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

function runAnimation(frameFunc) {
  let lastTime = null;
  function frame(time) {
    if (lastTime != null) {
      let timeStep = Math.min(time - lastTime, 100) / 1000;
      if (frameFunc(timeStep) === false) return;
    }
    lastTime = time;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function runLevel(level, Display) {
  let display = new Display(document.body, level);
  let state = State.start(level);
  let ending = 3;
  let scrollAmount = 0
  return new Promise(resolve => {
    runAnimation(time => {
      scrollAmount += time * 40;

      state = state.update(time, arrowKeys, display, scrollAmount);
      display.syncState(state, time, scrollAmount);


      if (state.status == "playing") {
        return true;
      } else if (ending > 0) {
        ending -= time;
        return true;
      } else {
        display.clear();
        resolve(state.status);
        return false;
      }
    });
  });
}

async function runGame(plans, Display) {

  for (let level = 0; level < plans.length;) {
    let status = await runLevel(new Level(plans[level]),
                                Display);
    if (status == "won") level++;
  }
  console.log("You've won!");
}
