var turtle_lang = function () {
    function isName(t) {
        return t !== undefined && t.test(/^[a-zA-Z]+$/);
    }

    function isNumber(t) {
        return t !== undefined && t.test(/^[0-9]+$/);
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
            var expr = prim();
            var t = peek();
            while (canStartExpression(t)) {
                var arg = prim();
                expr = out.call(expr, arg);
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

    function lambda(arg, body) { return {arg: arg, body: body}; }

    function eval(n, env, ctn) {
        switch (n.type) {
        case 'number':
            return ctn(n.value);
        case 'name':
            return ctn(env.get(n.name));
        case 'null':
            return ctn(null);
        case 'seq':
            var scope = Object.create(env);
            if (n.elements.length === 2)
                ;
        case 'function':
            if (n.args.length === 0)
                return ctn(lambda("_", n.body));
            else if (n.args.length === 1)
                return ctn(lambda(n.args[0], n.body));
            else
                return ctn(lambda(n.args[0], {type: 'function', args: n.args.slice(1), n.body}));
        case 'call':
            // evaluate fn
            // evaluate arg
            // apply
            // pass result to ctn
        }                

    function Thread(code) {
        var ast = parse(code, builder);
        var thisThread = this;
        this.alive = true;
        this.ctn = function () {
            switch (ast.type) {
            case 'number':
                console.log(ast.value),
            case 'name':
                
        };
    }

    Thread.prototype = {
        step: function () {
            this.ctn();
        }
    };

}();
