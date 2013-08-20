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
    }

    Bullet.prototype = {
        paintTo: function paintTo(ctx) {
            var len_x = 5 * this.vx, len_y = 5 * this.vy;
            if (Math.abs(len_x) > Math.abs(this.x - this.x0)) {
                len_x = this.x - this.x0;
                len_y = this.y - this.y0;
            }
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - len_x, this.y - len_y);
            ctx.strokeStyle = '#000';
            ctx.stroke();
        },

        checkHit: function checkHit(turtles) {
            for(var ii in turtles) {
                if (this.turtle == turtles[ii]) continue;
                var turtle = turtles[ii];

                return (this.x > turtle.x - turtle.r && this.x < turtle.x + turtle.r && this.y > turtle.y - turtle.r && this.y < turtle.y + turtle.r);
            }
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

        var self = this;
        this.tick_callback = function () {
            if (self.alive) {
                self.tick();
                setTimeout(self.tick_callback, 4);
            }
        };
        this.paint_callback = function () {
            if (self.alive) {
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
            ctx.fillStyle = "rgb(255,255,255)";
            var W = WALL_THICKNESS;
            ctx.fillRect(W, W, this.w - (2*W), this.h - (2*W));

            this.turtles.forEach(function (t) {
                t.paintTo(ctx);
            });

            this.bullets.forEach(function (b) {
                b.paintTo(ctx);
            });
        },

        tick: function tick() {
            var self = this;
            for (var i = 0; i < 6; i++) {
                this.turtles.forEach(function (t) {
                    if (t.thread.alive)
                        t.thread.step();
                });
            }
            this.bullets.forEach(function (b) {
                b.nextPosition();
                if (b.isOutOfBounds(self.canvas) || b.checkHit(self.turtles)) {
                    var index = self.bullets.indexOf(b);
                    if (index == -1) return;
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
