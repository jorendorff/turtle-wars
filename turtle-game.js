var turtle_game = (function () {
    // begin nonsense thoughtlessly copied from internet
    window.requestAnimFrame = (function(callback) {
        return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
            function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();
    // end nonsense


    // === Geometry

    // distToSegment by Grumdrig, http://stackoverflow.com/a/1501725/94977
    function sqr(x) {
        return x * x;
    }

    function dist2(v, w) {
        return sqr(v.x - w.x) + sqr(v.y - w.y);
    }

    function distToSegmentSquared(p, v, w) {
        var l2 = dist2(v, w);
        if (l2 == 0)
            return dist2(p, v);
        var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        if (t < 0)
            return dist2(p, v);
        if (t > 1)
            return dist2(p, w);
        return dist2(p, {x: v.x + t * (w.x - v.x),
                         y: v.y + t * (w.y - v.y)});
    }

    function distToSegment(p, v, w) {
        return Math.sqrt(distToSegmentSquared(p, v, w));
    }
    // this ends the section by Grumdig; mistakes after this are all mine

    function intersectSegmentToHalfPlane(seg, hp) {
        // Unpack arguments.
        var a = hp.a, b = hp.b, c = hp.c;
        var s0 = seg[0], x0 = s0.x, y0 = s0.y,
            s1 = seg[1], x1 = s1.x, y1 = s1.y;

        // Now the goal is to find the segment ((x0', y0'), (x1', y1'))
        // that is the intersection of
        // the segment          seg = ((x0, y0), (x1, y1))
        // and the half-plane   hp = {(x, y) | Ax + By + C >= 0}
        var c0 = a * x0 + b * y0 + c;
        var c1 = a * x1 + b * y1 + c;
        if (c0 < 0) {
            if (c1 < 0)
                return null;  // Neither endpoint is in hp.
            // s1 is in hp but s1 isn't.
            return [proportion_point(x0, y0, c0, x1, y1, c1), s1];
        } else if (c1 < 0) {
            // s0 is in hp but s1 isn't.
            return [s0, proportion_point(x0, y0, c0, x1, y1, c1)];
        } else {
            // Both endpoints (and thus all points in the segment) lie in hp.
            return seg;
        }

        function proportion_point(x0, y0, c0, x1, y1, c1) {
            var d = c0 / (c0 - c1);
            return {
                x: x0 + d * (x1 - x0),
                y: y0 + d * (y1 - y0)
            };
        }
    }

    function distToSegmentInWedge(p, dir, a, segment) {
        // 0 <= a < pi
        // But I think if a == 0, floating-point imprecision can probably cause
        // this to return null erroneously, so don't do that either.
        if (a < 0 || a >= Math.PI)
            throw new RangeError("invalid argument");

        // The first half-plane is the region to the left of
        // the ray from p in the direction a1.
        var a1 = dir - a/2, sin1 = Math.sin(a1), cos1 = Math.cos(a1);
        var hp1 = {a: -sin1, b:  cos1, c: p.x * sin1 - p.y * cos1};

        // The second half-plane is the region to the right of
        // the ray from p in the direction a2.
        var a2 = dir + a/2, sin2 = Math.sin(a2), cos2 = Math.cos(a2);
        var hp2 = {a:  sin2, b: -cos2, c: p.y * cos2 - p.x * sin2};

        // Simply truncate the segment to the part that intersects the wedge
        // (which is the intersection of the two half-planes).
        segment = intersectSegmentToHalfPlane(segment, hp1);
        if (segment === null)
            return null;
        segment = intersectSegmentToHalfPlane(segment, hp2);
        if (segment === null)
            return null;
        return distToSegment(p, segment[0], segment[1]);
    }

    function pointIsInWedge(p1, dir, a, p2) {
        // Half-planes are again the easiest way to settle this question.
        var a1 = dir - a/2;
        if ((p2.y - p1.y) * Math.cos(a1) < (p2.x - p1.x) * Math.sin(a1))
            return false;

        var a2 = dir + a/2;
        return (p2.y - p1.y) * Math.cos(a2) < (p2.x - p1.x) * Math.sin(a2);
    }

    function assert(x) { if (!x) throw new Error(); }
    assert(pointIsInWedge({x: 0, y: 0}, 0, Math.PI / 2, {x: 1, y: 0}));
    assert(pointIsInWedge({x: 0, y: 0}, 0, Math.PI / 2, {x: 2, y: 1}));
    assert(pointIsInWedge({x: 0, y: 0}, 0, Math.PI / 2, {x: 2, y: -1}));
    assert(!pointIsInWedge({x: 0, y: 0}, 0, Math.PI / 2, {x: -1, y: 0}));
    assert(!pointIsInWedge({x: 0, y: 0}, 0, Math.PI / 2, {x: 1, y: 2}));
    assert(!pointIsInWedge({x: 0, y: 0}, 0, Math.PI / 2, {x: 1, y: -2}));
    console.log("geometry tests passed");


    // === Bullets

    var BULLET_SPEED = 2;

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
            var len_x = 25 * this.vx, len_y = 25 * this.vy;
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
    var LookWall = 1, LookTurtle = 2;

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

        g.look = function (dir) {
            if (typeof dir != 'number')
                throw new TypeError("first argument to look must be a number");
            else if (dir === 1/0 || dir === -1/0 || isNaN(dir))
                throw new TypeError("first argument to look can't be " + dir);
            return function (width) {
                if (typeof width != 'number' || isNaN(width))
                    throw new TypeError("second argument to look must be a number");
                if (width > 180)
                    width = 180;
                else if (width < 1)
                    width = 1;

                dir = self.h + dir * (Math.PI / 180);
                width *= Math.PI / 180;

                var closestType = null, minDistance = 1/0;
                self.game.turtles.forEach(function (t) {
                    if (t !== self && pointIsInWedge(self, dir, width, t)) {
                        var dist = Math.sqrt(dist2(self, t));
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestType = LookTurtle;
                        }
                    }
                });
                self.game.walls.forEach(function (w) {
                    var dist = distToSegmentInWedge(self, dir, width, w);
                    if (dist !== null && dist < minDistance) {
                        minDistance = dist;
                        closestType = LookWall;
                    }
                });
                return {type: "pair", head: closestType, tail: minDistance};
            };
        };

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

        // The corners of the arena.
        var c = [
            {x: 0, y: 0},
            {x: this.w, y: 0},
            {x: this.w, y: this.h},
            {x: 0, y: this.h}
        ];
        this.walls = [
            [c[0], c[1]],
            [c[1], c[2]],
            [c[2], c[3]],
            [c[3], c[0]],
        ];

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
                this.bullets.forEach(function (b) {
                    b.nextPosition();
                    if (b.isOutOfBounds(self.canvas) || b.checkHit(self.turtles)) {
                        var index = self.bullets.indexOf(b);
                        if (index !== -1)
                            self.bullets.splice(index, 1);
                    }
                });
            }
        },

        stop: function stop() {
            this.alive = false;
        }
    };

    return {Turtle: Turtle, Game: Game};
})();
