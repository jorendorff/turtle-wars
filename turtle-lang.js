var turtle_lang = function () {
    function isName(t) {
        return t !== undefined && /^[a-zA-Z]+$/.test(t);
    }

    function isNumber(t) {
        return t !== undefined && /^[0-9]+$/.test(t);
    }

    var builder = {
        number:  function (t) {         return {type: 'number', value: parseInt(t)}; },
        name:    function(t) {          return {type: 'name', name: t}; },
        nil:     function() {           return {type: 'null'}; },
        seq:     function(a) {          return {type: 'seq', elements: a}; },
        assign:  function(name, expr) { return {type: 'assign', name: name, expr: expr}; },
        func:    function(arg, body)  { return {type: 'function', arg: arg, body: body}; },
        call:    function(fn, arg)    { return {type: 'call', fn: fn, arg: arg}; }
    };

    function parse(code, out) {
        var tokens = code.match(/\s*([A-Za-z]+|[0-9]+|=>|\S)/g);
        for (var i = 0; i < tokens.length; i++)
            tokens[i] = tokens[i].trim();

        var pos = 0;

        function peek() {
            return tokens[pos];
        }

        function lookAhead(n) {
            return tokens[pos + n];
        }

        function consume(t) {
            if (t !== peek())
                throw new Error("internal error: consume mismatch");
            pos++;
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
            var t = peek();
            if (isNumber(t)) {
                consume(t);
                return out.number(t);
            } else if (isName(t)) {
                consume(t);
                return out.name(t);
            } else if (t === "!") {
                consume("!");
                return out.nil();
            } else if (t == "(") {
                consume("(");
                var e = parseExpr();
                if (peek() != ")")
                    throw new Error("either a bogus token or a missing ')'");
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
                    throw new Error("expected '}'");
                consume('}');

                if (args.length === 0)
                    args.push("_");

                var result = body;
                while (args.length !== 0)
                    result = out.func(args.pop(), result);
                return result;
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
            var expr = parsePrim();
            var t = peek();
            while (canStartExpression(t)) {
                var arg = parsePrim();
                expr = out.call(expr, arg);
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
            if (isName(t) && lookAhead(1) == "=") {
                consume(t);
                consume("=");
                return out.assign(t, parseCall());
            }
            return parseCall();
        }

        /*
          expr:
          element
          expr , element
        */
        function parseExpr() {
            var e = parseElement();
            if (peek() !== ",")
                return e;

            var a = [e];
            while (peek() == ",") {
                consume(",");
                a.push(parseElement());
            }
            if (a[a.length - 1].type == "let") {
                throw new Error("syntax error: the last thing in this sequence " +
                                "is an assignment, which doesn't make sense to me");
            }
            return out.seq(a);
        }

        var result = parseExpr();
        if (pos !== tokens.length)
            throw new Error("syntax error: didn't expect '" + peek() + "'");
        return result;
    }


    // === Interpreter

    function lambda(arg, body, env) {
        return {type: "lambda", arg: arg, body: body, env: env};
    }

    function evaluate_later(ast, env, ctn) {
        return {type: "suspended thread state", ast: ast, env: env, ctn: ctn};
    }

    function evaluate(n, env, ctn) {
        assert(typeof env == "object");

        /*
        var orig = ctn;
        ctn = function (v) {
            var r = orig(v); 
            if (r === undefined || r === null)
                console.log("FAIL FAIL FAIL:" + orig);
            return r;
        };
*/

        switch (n.type) {
        case 'number':
            return ctn(n.value);

        case 'name':
            return ctn(n.name in env ? env[n.name] : null);

        case 'null':
            return ctn(null);

        case 'seq':
            var scope = Object.create(env);
            for (var i = 0; i < n.elements; i++)
                if (n.elements[i].type === 'assign')
                    scope[n.elements[i].name] = null;

            var i = 0;
            var go = function to_next(v) {
                if (i === n.elements.length)
                    return ctn(v);
                else
                    return evaluate_later(n.elements[i++], scope, to_next);
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
                        throw new Error("type error: tried to call " + f + "() but it is not a function");
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
            this.state = evaluate(s.ast, s.env, s.ctn);
            assert(this.state != null);
        },

        _done: function (v) {
            this.alive = false;
            this.result = v;
            console.log("thread finished! value was: ", v);
            return {type: "nothing to do"};
        }
    };

    function assert(t) {
        if (t !== true)
            throw new Error("assertion failed at " + new Error().stack/*.split('\n')[1]*/);
    }


    // === Base environment

    var globals = Object.create(null);
    globals.add = function (a) { return function (b) { return a + b; }; };
    globals.neg = function (a) { return -a; };
    globals.sub = function (a) { return function (b) { return a - b; }; };
    globals.mul = function (a) { return function (b) { return a * b; }; };
    globals.div = function (a) { return function (b) { return a / b; }; };


    // === Tests

    function test() {
        function ev(code, val) {
            var t = new Thread(code, globals);
            while (t.alive)
                t.step();
            assert(t.result === val);
        }

        ev("3", 3);
        ev("add 3 4", 7);
        ev("x=1", 1);
        ev("1,2", 2);
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

        // Church numeral tests
        ev("zero = {f x => x}, chtoint = {ch => ch {x => add x 1} 0}, chtoint zero", 0);
        ev("one = {f x => f x}, chtoint = {ch => ch {x => add x 1} 0}, chtoint one", 1);
        ev("zero = {f x => x}, inc = {k f x => k f (f x)}, one = inc zero,\n" +
           "chtoint = {ch => ch {x => add x 1} 0}, chtoint (inc (inc one))", 3);

        console.log("all tests passed");
    }
    test();

    return {
        Thread: Thread,
        globals: globals
    };

}();
