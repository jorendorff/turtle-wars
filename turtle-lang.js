var turtle_lang = function () {
    function isName(t) {
        return t !== undefined && /^[A-Za-z]/.test(t);
    }

    function isNumber(t) {
        return t !== undefined && /^[0-9]/.test(t);
    }

    var builder = {
        number:  function (loc, t)          { return {loc: loc, type: 'number', value: parseInt(t)}; },
        name:    function (loc, t)          { return {loc: loc, type: 'name', name: t}; },
        nil:     function (loc)             { return {loc: loc, type: 'nil'}; },
        seq:     function (loc, a)          { return {loc: loc, type: 'seq', elements: a}; },
        assign:  function (loc, name, expr) { return {loc: loc, type: 'assign', name: name, expr: expr}; },
        func:    function (loc, arg, body)  { return {loc: loc, type: 'function', arg: arg, body: body}; },
        call:    function (loc, fn, arg)    { return {loc: loc, type: 'call', fn: fn, arg: arg}; }
    };

    function parse(code, out) {
        // tokenize code
        var tokens = [];
        var tokenRegExp = /([A-Za-z][A-Za-z0-9?-]+|[0-9]+|=>|\S)\s*/g;
        tokenRegExp.lastIndex = /\s*/.exec(code)[0].length;
        var m;
        while ((m = tokenRegExp.exec(code)) !== null)
            tokens.push(m);

        var pos = 0;  // index of the first not-yet-consumed token in `tokens`

        function peek() {
            return pos >= tokens.length ? undefined : tokens[pos][1];
        }

        function lookAhead(n) {
            return pos + n >= tokens.length ? undefined : tokens[pos + n][1];
        }

        function consume(t) {
            if (t !== peek()) {
                throw new Error("internal error: consume mismatch (expected '"
                                + t + "', got '" + peek() + "' at offset " + startOfNext() + ")");
            }
            pos++;
        }

        function startOfNext() {
            return pos >= tokens.length ? -1 : tokens[pos].index;
        }

        function endOfPrev() {
            return pos === 0 ? -1 : tokens[pos - 1].index + tokens[pos - 1][1].length;
        }

        function syntaxError(msg, loc) {
            if (loc === undefined) {
                var start = startOfNext();
                if (start !== -1)
                    loc = [start, start + peek().length];
                else
                    loc = [code.length, code.length];
            }

            var exc = new Error(msg);
            exc.loc = loc;
            throw exc;
        }

        /*
          prim:
            number
            name
            !
            ( expr )
            { expr }
            { args => expr }
        */
        function parsePrim() {
            var p0 = startOfNext();
            var t = peek();
            if (isNumber(t)) {
                consume(t);
                return out.number([p0, p0 + t.length], t);
            } else if (isName(t)) {
                consume(t);
                return out.name([p0, p0 + t.length], t);
            } else if (t === "!") {
                consume("!");
                return out.nil([p0, p0 + 1]);
            } else if (t == "(") {
                consume("(");
                var e = parseExpr();
                if (peek() != ")")
                    syntaxError("expected ')'");
                consume(")");
                return e;
            } else if (t == "{") {
                consume('{');
                // infinite lookahead, whee!
                var i = 0;
                while (isName(lookAhead(i)))
                    i++;
                var args = [];
                if (lookAhead(i) === "=>") {
                    // function with arguments
                    var t = peek();
                    while (isName(t)) {
                        consume(t);
                        args.push(t);
                        t = peek();
                    }
                    consume("=>");
                }
                var body = parseExpr();
                if (peek() != "}")
                    syntaxError("expected '}'");
                consume('}');
                var p = [p0, endOfPrev()];

                if (args.length === 0)
                    args.push("_");

                var result = body;
                while (args.length !== 0)
                    result = out.func(p, args.pop(), result);
                return result;
            } else {
                syntaxError("unexpected " +
                            (pos === tokens.length ? "end of code" : "'" + t + "'"));
            }
        }

        var delimiters = [')', '}', ',', undefined];
        function canStartExpression(t) {
            return delimiters.indexOf(t) === -1;
        }

        /*
          call:
            prim
            call prim
        */
        function parseCall() {
            var p0 = startOfNext();
            var expr = parsePrim();
            var t = peek();
            while (canStartExpression(t)) {
                var arg = parsePrim();
                expr = out.call([p0, endOfPrev()], expr, arg);
                t = peek();
            }
            return expr;
        }

        /*
          element:
            call
            name = call
        */
        function parseElement() {
            var t = peek();
            if (isName(t) && lookAhead(1) === "=") {
                var p0 = startOfNext();
                consume(t);
                consume("=");
                var rhs = parseCall();
                var p1 = endOfPrev();
                return out.assign([p0, p1], t, rhs);
            }
            return parseCall();
        }

        /*
          An expr is a sequence of 1 or more elements, separated by commas.
          But the last one may not be an assignment.

          expr:
            call
            seq , call

          seq:
            element
            seq , element
        */
        function parseExpr() {
            var p0 = startOfNext(), pe = p0;
            var e = parseElement();
            var a = [e];
            var names = Object.create(null);
            var isAssign = e.type === "assign";
            if (isAssign)
                names[e.name] = true;
            while (peek() === ",") {
                consume(",");
                pe = startOfNext();
                e = parseElement();

                isAssign = e.type === "assign";
                if (isAssign) {
                    if (e.name in names)
                        syntaxError("assigning to the same variable more than once",
                                    [pe, endOfPrev()]);
                    names[e.name] = true;
                }

                a.push(e);
            }
            if (isAssign) {
                syntaxError("the last thing in this sequence " +
                            "is an assignment, which doesn't make sense to me",
                            [pe, endOfPrev()]);
            }
            if (a.length === 1)
                return e;
            else
                return out.seq([p0, endOfPrev()], a);
        }

        var result = parseExpr();
        if (pos !== tokens.length)
            syntaxError("didn't expect '" + peek() + "'");
        return result;
    }

    function assertMatch(actual, expected) {
        var sa = JSON.stringify(actual);
        var se = JSON.stringify(expected);
        if (sa !== se)
            throw new Error("assertion failed: got " + sa + ", expected " + se);
    }

    function testParser() {
        // These are mostly testing position information.

        function p(code, expected) {
            assertMatch(parse(code, builder), expected);
        }

        function err(code, loc) {
            try {
                parse(code, builder);
            } catch (exc) {
                if (!(exc instanceof Error) || !("loc" in exc))
                    throw exc;
                var actual = JSON.stringify(exc.loc);
                var expected = JSON.stringify(loc);
                if (actual !== expected) {
                    throw new Error("got error at " + actual + ", " +
                                    "expected error at " + expected + " (" + exc + ")");
                }
                return;
            }
            throw new Error("expected exception, none thrown");
        }

        p(" !", {loc: [1, 2], type: "nil"});
        p("  (2)", {loc: [3, 4], type: "number", value: 2});
        p("f(2)", {
            loc: [0, 4], type: "call",
            fn: {loc: [0, 1], type: "name", name: "f"},
            arg: {loc: [2, 3], type: "number", value: 2}
        });
        p("add 13 1\n", {
            loc: [0, 8], type: "call",
            fn: {
                loc: [0, 6], type: "call",
                fn: {loc: [0, 3], type: "name", name: "add"},
                arg: {loc: [4, 6], type: "number", value: 13},
            },
            arg: {loc: [7, 8], type: "number", value: 1}
        });
        p("x ! , f", {
            loc: [0, 7], type: "seq",
            elements: [
                {
                    loc: [0, 3], type: "call",
                    fn: {loc: [0, 1], type: "name", name: "x"},
                    arg: {loc: [2, 3], type: "nil"}
                },
                {loc: [6, 7], type: "name", name: "f"}
            ]
        });

        err("a,,", [2, 3]);
        err("z123456=8,z123456=8,0", [10, 19]);
        err("a=1", [0, 3]);
        err("a=2,b=6,c=11", [8, 12]);
    }
    testParser();


    // === Interpreter
    //
    // Of course we could compile this stuff to JavaScript, but the key feature
    // we're looking for in running turtle-lang code is the ability to step
    // deterministically.
    //
    // Lacking ES6 generators, supporting that would be a nonlocal
    // transformation to CPS and the output code would be a mess.
    //
    // Making an interpreter step-friendly, though, is quite easy. So we've got
    // an interpreter.

    function lambda(arg, body, env) {
        return {type: "lambda", arg: arg, body: body, env: env};
    }

    function evaluate_later(ast, env, ctn) {
        return {type: "suspended thread state", ast: ast, env: env, ctn: ctn};
    }

    function runtimeError(msg, loc) {
        var exc = new Error(msg);
        exc.loc = loc;
        throw exc;
    }

    // ctn is a JS function: the continuation of n.
    // If debugging UI requires something more inspectable than a JS function
    // it could be changed to some kind of data structure pretty easily.
    function evaluate(n, env, ctn) {
        assert(typeof env == "object");

        switch (n.type) {
        case 'number':
            return ctn(n.value);

        case 'name':
            var result = env[n.name];
            if (result === undefined) {
                runtimeError(n.name in env
                             ? "this local variable isn't initialized yet"
                             : "no such variable in scope",
                             n.loc);
            }
            return ctn(env[n.name]);

        case 'nil':
            return ctn(null);

        case 'seq':
            var scope = Object.create(env);
            for (var i = 0; i < n.elements.length; i++)
                if (n.elements[i].type === 'assign')
                    scope[n.elements[i].name] = undefined;

            var i = 0;
            var go = function to_next(_) {
                var expr = n.elements[i++];
                return evaluate_later(
                    expr, scope, i === n.elements.length ? ctn : to_next);
            };
            return go(null);

        case 'assign':
            return evaluate(n.expr, env, function (v) {
                env[n.name] = v;
                return ctn(v);
            });

        case 'function':
            return ctn(lambda(n.arg, n.body, env));

        case 'call':
            return evaluate(n.fn, env, function (f) {
                return evaluate(n.arg, env, function (a) {
                    if (typeof f === "function") {
                        return ctn(f(a));
                    } else if (typeof f === "object" && f !== null && f.type === "lambda") {
                        var scope = Object.create(f.env);
                        scope[f.arg] = a;
                        return evaluate_later(f.body, scope, ctn);
                    } else {
                        runtimeError("type error: tried to call " + f + "() but it is not a function", n.loc);
                    }
                });
            });
        }
        throw new Error("internal error: " + uneval(n));
    }

    function Thread(code, env) {
        var ast = parse(code, builder);
        var thisThread = this;
        this.alive = true;
        this.state = evaluate_later(ast, env, this._done.bind(this));
    }

    Thread.prototype = {
        step: function () {
            var s = this.state;
            try {
                this.state = evaluate(s.ast, s.env, s.ctn);
            } catch (exc) {
                this.alive = false;
                this.result = null;
                this.state = {type: "uncaught exception", message: "" + exc};
                throw exc;
            }
            assert(this.state != null);
        },

        run: function () {
            while (this.alive)
                this.step();
            return this.result;
        },

        _done: function (v) {
            this.alive = false;
            this.result = v;
            return {type: "nothing to do"};
        }
    };

    function assert(t) {
        if (t !== true)
            throw new Error("assertion failed at " + new Error().stack/*.split('\n')[1]*/);
    }


    // === Base environment

    var globals = Object.create(null);

    function turtle_eval(code, env) {
        if (env === undefined)
            env = globals;
        var t = new Thread(code, env);
        while (t.alive)
            t.step();
        return t.result;
    }

    globals.add = function (a) { return function (b) { return a + b; }; };
    globals.neg = function (a) { return -a; };
    globals.sub = function (a) { return function (b) { return a - b; }; };
    globals.mul = function (a) { return function (b) { return a * b; }; };
    globals.div = function (a) { return function (b) { return a / b; }; };
    globals["eq?"] = function (a) { return function (b) { return a === b; }; };
    globals["gt?"] = function (a) { return function (b) { return a > b; }; };
    globals["ge?"] = function (a) { return function (b) { return a >= b; }; };
    globals["lt?"] = function (a) { return function (b) { return a < b; }; };
    globals["le?"] = function (a) { return function (b) { return a <= b; }; };

    globals.true = true;
    globals.false = false;
    globals['boolean?'] = function (x) { return typeof x === "boolean"; };
    globals.not = function (b) { return b === false || b === null; };
    function _first(x)  { return function (_) { return x; }; }
    function _second(_) { return function (x) { return x; }; }
    globals.select = function (a) {
        return (a === false || a === null) ? _second : _first;
    };
    globals.if = turtle_eval("{a b c => (select a b c)!}");

    globals.while = turtle_eval("{p c => if (p!) {c!, while p c} {!}}");
    globals.rep = turtle_eval("{n f => if (le? n 0) {!} {f!, rep (sub n 1) f}}");
    globals.forever = turtle_eval("{f => f!, forever f}");

    // Pairs and lists
    globals["nil?"] = function (a) { return a === null; };
    globals["pair?"] = function (a) {
        return typeof a === "object" && a !== null && a.type === "pair";
    };
    globals.pair = function (a) { return function (b) {
        return {type: "pair", head: a, tail: b};
    }; };
    globals.head = function (p) { return p.head; };
    globals.tail = function (p) { return p.tail; };
    globals.length = turtle_eval("{l => if (nil? l) {0} {add 1 (length (tail l))}}");
    globals.map = turtle_eval("{f l => if (nil? l) {l} {pair (f (head l)) (map f (tail l))}}");
    globals.filter = turtle_eval("{p l =>\n" +
                                 "  if (nil? l) {l} {\n" +
                                 "    pass = p (head l), rest = filter p (tail l),\n" +
                                 "    if pass {pair pass rest} {rest}}}");
    globals.foldl = turtle_eval("{f a l =>\n" +
                                "  if (nil? l) {a} {\n" +
                                "    foldl f (f a (head l)) (tail l)}}");

    // === Tests

    function assertThrows(fn, pred) {
        try {
            fn();
        } catch (exc) {
            if (!pred(exc)) {
                throw new Error("assertion failed: expected an exception " +
                                "that would pass " + pred.name + ", got " + exc);
            }
            return;
        }
        throw new Error("assertion failed: expected an exception " +
                        "that would pass " + pred.name + ", no exception thrown");
    }

    function test() {
        function ev(code, val, env) {
            var t = new Thread(code, env || globals);
            while (t.alive)
                t.step();
            //console.log("'" + code + "' ===> " + t.result);
            assert(t.result === val);
        }

        function err(code) {
            assertThrows(function () { parse(code, builder); },
                         function isError(exc) { return exc instanceof Error; });
        }

        function rterr(code, env, loc) {
            var t = new Thread(code, env || globals);
            assertThrows(function () { t.run(); },
                         function isRuntimeErrorAtLocation(exc) {
                             return exc instanceof Error
                                    && exc.loc
                                    && (!loc
                                        || (exc.loc[0] == loc[0] && exc.loc[1] == loc[1]));
                         });
        }

        err("");
        ev("3", 3);
        rterr("undefined", null, [0, 9]);
        ev("add", globals.add);
        ev("add 3 4", 7);
        rterr("1 2", null, [0, 3]);
        err("x=1");
        ev("x=1, x", 1);
        err("x=1,y=2");
        err("x = 1, x = 2, x");
        ev("x = 1, (x = 2, x)", 2);
        ev("x = 1, (x = 2, x), x", 1);
        err("x = 1, y = 2, y = 3, x");
        rterr("x=y, y=x, x", null, [2, 3]);
        ev("1,2", 2);
        rterr("x=2, (y=x, x=13, y)", null, [8, 9]);

        err(",");
        err("1,");
        err("1,,2");
        err("{1,}");
        err("{1, }");
        err("x = ");
        ev("x = add 2 2, mul x 7", 28);
        ev("!", null);
        ev("{ 2 } !", 2);
        ev("{x => add x 1} 3", 4);
        ev("inc = {x => add x 1}, inc 15", 16);
        ev("{a b => sub b a} 13 31", 18);
        ev("{a b c => 0} 0 0 0", 0);
        ev("{a b c => c} 1 2 3", 3);
        ev("{a b c d => d} 1 2 3 4", 4);
        ev("{a b c d => add c d} 1 2 3 4", 7);
        ev("{a b c d => add b (add c d)} 1 2 3 4", 9);
        ev("{a b c d => add (add a b) (add c d)} 1 2 3 4", 10);
        ev("sumfour = {a b c d => add (add a b) (add c d)}, sumfour 1 2 3 4", 10);
        ev("eq? 1 2", false);
        ev("eq? (add 2 2) 4", true);

        // Church numeral tests
        ev("zero = {f x => x}, chtoint = {ch => ch {x => add x 1} 0}, chtoint zero", 0);
        ev("one = {f x => f x}, chtoint = {ch => ch {x => add x 1} 0}, chtoint one", 1);
        ev("zero = {f x => x}, inc = {k f x => k f (f x)}, one = inc zero,\n" +
           "chtoint = {ch => ch {x => add x 1} 0}, chtoint (inc (inc one))", 3);

        // Booleans and if
        ev("if 1 {2} {3}", 2);
        ev("if false {4} {5}", 5);
        ev("erode = {a => if (eq? a 0) {a} {erode (sub a 1)}}, erode 57", 0);

        // Pairs and lists
        ev("head (pair 1 2)", 1);
        ev("pair? !", false);
        ev("nil? !", true);
        ev("length !", 0);
        ev("length (pair 1 (pair 2 (pair 3 !)))", 3);
        ev("map {0!} !", null);
        ev("filter {whatever => false} (pair 1 (pair 2 !))", null);
        ev("foldl add 0 (map (add 1) (pair 1 (pair 2 (pair 3 !))))", 9);
        ev("range = {start stop => if (eq? start stop) {!} {pair start (range (add 1 start) stop)}},\n" +
           "sum = foldl add 0,\n" +
           "sum (range 0 101)", 5050);

        // Tests involving side effects
        var locals = Object.create(globals);
        locals.box = function (v) { return {type: "box", value: v}; };
        locals.get = function (box) { return box.value; };
        locals.put = function (box) { return function (v) { box.value = v; return null; }; };
        ev("a = box!, put a 3, get a", 3, locals);
        ev("a = box 0, while {not (eq? (get a) 5) } {put a (add (get a) 1)}, get a", 5, locals);
        ev("a = box 1, rep 6 {put a (mul (get a) 2) }, get a", 64, locals);

        // We cannot run forever, but try it for a while at least.
        locals.a = locals.box(0);
        var t = new Thread("forever {put a (add (get a) 1)}", locals);
        while (t.alive && locals.a.value === 0)
            t.step();
        assert(t.alive);
        assert(locals.a.value === 1);

        // Measure the number of steps dt it takes to make one cycle through
        // the loop.
        var dt = 0;
        while (t.alive && locals.a.value === 1) {
            t.step();
            dt++;
        }
        assert(t.alive);
        assert(locals.a.value === 2);

        // Check that after 100 cycles, the value is as expected.
        var N = 100;
        for (var i = 0; i < N*dt; i++)
            t.step();
        assert(t.alive);
        assert(locals.a.value === 2 + N);

        console.log("all tests passed");
    }
    test();

    return {
        Thread: Thread,
        globals: globals,
        Function: Function,
        eval: turtle_eval
    };

}();
