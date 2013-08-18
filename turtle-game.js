var turtle_game = (function () {
    // begin nonsense thoughtlessly copied from internet
    window.requestAnimFrame = (function(callback) {
        return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
            function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();
    // end nonsense

    var BULLET_SPEED = 5;

    function Bullet(x, y, direction) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.direction = direction;
    }

    Bullet.prototype = {
        paintTo: function paintTo(ctx) {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - 5 * this.vx, this.y - 5 * this.vy);
            ctx.strokeStyle = '#000';
            ctx.stroke();
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

    function Turtle(ast, color) {
        this.ast = ast;
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
            var b = new Bullet(this.x, this.y, this.h);
            b.vx = BULLET_SPEED * Math.cos(this.h);
            b.vy = BULLET_SPEED * Math.sin(this.h);
            return b;
        }
    };

    function Fight(turtles, canvas) {
        // the state of a fight is: the position of the turtles, their internal
        // program execution state, and the state of the bullets -- but let's
        // ignore bullets for now
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

        this.paint_callback();
        this.tick_callback();
    }

    Fight.prototype = {
        start: function start() {
            var self = this;
            setTimeout(function () { self.tick(); }, 4);
            this.turtles.forEach(function(t) {
                self.bullets.push(t.shoot());
            });
        },

        paint: function paint() {
            var self = this;
            var ctx = this.canvas.getContext('2d');
            ctx.fillStyle = "rgb(0,0,0)";
            ctx.fillRect(0, 0, this.w, this.h);
            ctx.fillStyle = "rgb(255,255,255)";
            var W = 4;
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
            this.bullets.forEach(function(b) {
                b.nextPosition();
                if (b.isOutOfBounds(self.canvas)) {
                    var index = self.bullets.indexOf(b);
                    if (index == -1) return;
                    self.bullets.splice(index, 1);
                }
            });
        },

        stop: function stop() {
            alive = false;
        }
    };

    return {Turtle: Turtle, Fight: Fight};
})();
