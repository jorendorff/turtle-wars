var turtle_game = (function () {
    // begin nonsense thoughtlessly copied from internet
    window.requestAnimFrame = (function(callback) {
        return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
            function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();
    // end nonsense

    function Bullet(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
    }


    function Turtle(ast, color) {
        this.ast = ast;
        this.x = 0;
        this.y = 0;
        this.h = 0; // heading
        this.r = 9; // Turtle radius
        this.color = color;
    }

    var BULLET_SPEED = 5;

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
            var b = new Bullet(x, y);
            b.vx = BULLET_SPEED * Math.cos(this.h);
            b.vy = BULLET_SPEED * Math.sin(this.h);
            this.game.push(b);
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
        turtles.forEach(function (t) {
            t.game = self;
        });

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
        },

        paint: function paint() {
            var ctx = this.canvas.getContext('2d');
            ctx.fillStyle = "rgb(0,0,0)";
            ctx.fillRect(0, 0, this.w, this.h);
            ctx.fillStyle = "rgb(255,255,255)";
            var W = 4;
            ctx.fillRect(W, W, this.w - (2*W), this.h - (2*W));
            this.turtles.forEach(function (t) {
                t.paintTo(ctx);
            });
        },

        tick: function tick() {
        },

        stop: function stop() {
            alive = false;
        }
    };

    return {Turtle: Turtle, Fight: Fight};
})();
