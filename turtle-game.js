var turtle_game = (function () {
    // begin nonsense thoughtlessly copied from internet
    window.requestAnimFrame = (function(callback) {
        return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
            function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();
    // end nonsense


    // === Bullets

    var BULLET_SPEED = 10;

    function Bullet(x, y, direction, turtle) {
        this.x0 = x;  // origin
        this.y0 = y;
        this.x = x;   // current position
        this.y = y;
        this.vx = BULLET_SPEED * Math.cos(direction);
        this.vy = BULLET_SPEED * Math.sin(direction);
        this.direction = direction;
        this.turtle = turtle;
        this.color =
            turtle.color === 'rgb(80,40,0)'
            ? 'rgba(255, 160, 20, 0.6)'
            : 'rgba(80, 255, 160, 0.4)';
    }

    Bullet.prototype = {
        paintTo: function paintTo(ctx) {
            var color = this.color;
            var x1 = this.x, y1 = this.y;
            var len_x = 5 * this.vx, len_y = 5 * this.vy;
            var x0, y0;
            if (Math.abs(len_x) > Math.abs(this.x - this.x0)) {
                len_x = this.x - this.x0;
                len_y = this.y - this.y0;
            }
            x0 = x1 - len_x;
            y0 = y1 - len_y;
            ctx.lineCap = "round";
            function draw(w) {
                ctx.lineWidth = w;
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.strokeStyle = color;
                ctx.stroke();
            }
            draw(4);
            draw(3);
            ctx.lineWidth = 1;
        },

        checkHit: function checkHit(turtles) {
            for (var ii in turtles) {
                var turtle = turtles[ii];
                if (turtle !== this.turtle
                    && Math.pow(turtle.x - this.x, 2) + Math.pow(turtle.y - this.y, 2)
                       < Math.pow(turtle.r, 2)) {
                    return turtle;
                }
            }
            return null;
        },

        nextPosition: function nextPosition(ctx) {
            this.x += this.vx;
            this.y += this.vy;
        },

        isOutOfBounds: function isOutOfBounds(canvas) {
            if (!canvas) return;

            var result = (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height);

            return result;
        }
    }


    // === Turtles

    var TURTLE_SPEED = 1;

    function Turtle(code, color) {
        var self = this;

        // Set up the global functions for turtle_lang.
        var g = Object.create(turtle_lang.globals);
        g.shoot = function () {
            self.game.bullets.push(self.shoot());  // i love oop
            return null;
        };
        g.rt1 = function () { self.h += Math.PI / 180; return null; };
        g.lt1 = function () { self.h -= Math.PI / 180; return null; };
        g.fd1 = function () {
            self.x += TURTLE_SPEED * Math.cos(self.h);
            self.y += TURTLE_SPEED * Math.sin(self.h);

            // If the turtle is out of bounds, move it back.
            var limit = self.r + WALL_THICKNESS;
            self.x = Math.max(limit, Math.min(self.x, self.game.canvas.width - limit));
            self.y = Math.max(limit, Math.min(self.y, self.game.canvas.height - limit));
            return null;
        };
        g.rt = turtle_lang.eval("{n => rep n {rt1!}}", g);
        g.lt = turtle_lang.eval("{n => rep n {lt1!}}", g);
        g.fd = turtle_lang.eval("{n => rep n {fd1!}}", g);

        this.thread = new turtle_lang.Thread(code, g);

        this.x = 0;
        this.y = 0;
        this.h = 0; // heading
        this.r = 9; // Turtle radius
        this.color = color;
    }

    Turtle.prototype = {
        paintTo: function paintTo(ctx) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, 2*Math.PI);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.stroke();
        },

        shoot: function shoot() {
            return new Bullet(this.x, this.y, this.h, this);
        }
    };


    // === Game

    function Game(turtles, canvas) {
        // the state of a game is: the position of the turtles, their internal
        // program execution state, and the state of the bullets
        this.turtles = turtles;
        this.bullets = [];
        this.canvas = canvas;
        this.w = canvas.width;
        this.h = canvas.height;
        this.alive = true;
        this.lastUpdate = Date.now();

        var self = this;
        this.tick_callback = function () {
            if (self.alive) {
                self.update();
                setTimeout(self.tick_callback, 4);
            }
        };
        this.paint_callback = function () {
            if (self.alive) {
                self.update();
                self.paint();
                requestAnimFrame(self.paint_callback);
            }
        };
    }

    var WALL_THICKNESS = 4;

    Game.prototype = {
        start: function start() {
            var self = this;
            this.turtles.forEach(function(t) {
                t.game = self;
            });
            this.paint_callback();
            this.tick_callback();
        },

        paint: function paint() {
            var self = this;
            var ctx = this.canvas.getContext('2d');
            ctx.fillStyle = "rgb(0,0,0)";
            ctx.fillRect(0, 0, this.w, this.h);
            ctx.fillStyle = "rgb(23,84,7)";
            var W = WALL_THICKNESS;
            ctx.fillRect(W, W, this.w - (2*W), this.h - (2*W));

            this.turtles.forEach(function (t) {
                t.paintTo(ctx);
            });

            this.bullets.forEach(function (b) {
                b.paintTo(ctx);
            });
        },

        update: function update() {
            var now = Date.now();
            var dt = now - this.lastUpdate;
            this.lastUpdate = now;

            var self = this;
            for (var i = 0; i < dt; i++) {
                this.turtles.forEach(function (t) {
                    if (t.thread.alive)
                        t.thread.step();
                });
            }
            this.bullets.forEach(function (b) {
                b.nextPosition();
                if (b.isOutOfBounds(self.canvas) || b.checkHit(self.turtles)) {
                    var index = self.bullets.indexOf(b);
                    if (index !== -1)
                        self.bullets.splice(index, 1);
                }
            });
        },

        stop: function stop() {
            this.alive = false;
        }
    };

    return {Turtle: Turtle, Game: Game};
})();
