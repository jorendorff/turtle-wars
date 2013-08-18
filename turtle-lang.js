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
        func:    function(args, body) { return {type: 'function', args: args, body: body}; },
        call:    function(fn, args)   { return {type: 'call', fn: fn, args: args}; }
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
                return out.func(args, body);
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

    function lambda(arg, body) { return {type: "lambda", arg: arg, body: body}; }

    function evaluate_later(ast, env, ctn) {
        return {type: "suspended thread state", ast: ast, env: env, ctn: ctn};
    }

    function evaluate(n, env, ctn) {
        assert(typeof env == "object");

        switch (n.type) {
        case 'number':
            return ctn(n.value);

        case 'name':
            return ctn(env.get(n.name));

        case 'null':
            return ctn(null);

        case 'seq':
            var scope = Object.create(env);
            for (var i = 0; i < n.elements; i++)
                if (n.elements[i].type === 'assign')
                    scope[n.elements[i].name] = null;
            return evaluate(n.elements[0], scope, function (_) {
                return evaluate_later(n.elements[1], scope, ctn);
            });

        case 'assign':
            return evaluate(n.expr, env, function (v) {
                env[n.name] = v;
                ctn();
            });

        case 'function':
            if (n.args.length === 0)
                return ctn(lambda("_", n.body));
            else if (n.args.length === 1)
                return ctn(lambda(n.args[0], n.body));
            else
                return ctn(lambda(n.args[0], {type: 'function', args: n.args.slice(1), body: n.body}));

        case 'call':
            return evaluate(n.fn, env, function (f) {
                console.log("GOT HERE 1");
                return evaluate(n.arg, env, function (a) {
                    console.log("GOT HERE 2");
                    if (typeof f === "function") {
                        console.log("GOT HERE 3");
                        return ctn(f(a));
                    } else if (f.type === "lambda") {
                        var scope = Object.create(env);
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
        },

        _done: function (v) {
            this.alive = false;
            this.result = v;
            console.log("thread finished! value was: ", v);
        }
    };

    function assert(t) {
        if (t !== true)
            throw new Error("assertion failed at " + new Error().stack/*.split('\n')[1]*/);
    }

    function test() {
        var globals = Object.create(null);
        globals.inc = function (a) { console.log("inc(" + a + ")"); return a + 1; };
        globals.add = function (a) { return function (b) { return a + b; } };

        var t = new Thread("3");
        console.log(uneval(t.state.ast));
        while (t.alive)
            t.step();
        assert(t.result === 3);

        t = new Thread("inc(3)");
        while (t.alive)
            t.step();
        // assert(t.result === 4);

        console.log("all tests passed");
    }
    test();

}();
