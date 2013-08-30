# Getting started.

Try it out: load up
[the web page](http://jorendorff.github.io/turtle-wars/turtle-wars.html)
and click the "Fight!" button.


# How to program your turtle

Here is a very simple turtle program.

    forever {fd 20, rt 10}

Choose one of the two text boxes on the screen,
clobber all the code,
paste that one line of code in there,
then click "Fight!"
to see this program in action.

The meaning of this program is:

* Go forward 20 pixels.
* Turn slightly right (just 10&deg;).
* Keep doing those two steps forever.

This will cause your turtle to go in circles.
It may bump into the walls a lot at first.
You can't win the game doing that,
so let's add one more thing.

    forever {fd 20, rt 10, shoot !}

Simply delete your other program, paste this in,
and click "Fight!" again.

## Functions and nil

What is the `!` for?
`!` means `nil`.

As in a lot of programming languages,
`shoot` by itself means "the shoot function";
if you want actually to *call* that function
(that is, if you really want to shoot),
you must provide an argument.

Function call syntax in the turtle language
is just like Haskell or ML: *function* *argument*

Some functions are curried; that is, they take
several arguments like so: *function* *arg1* *arg2* *arg3*.

Anyway, the **shoot** function ignores its argument.
You can pass whatever value you want (for now),
but the proper way is to pass `!`
which is like saying "just do it already".


## Spaces are ignored

Perhaps you would rather write the above program like this:

    forever {
        fd 20,
        rt 10,
        shoot !
    }

That's up to you,
since spaces and line breaks
have no significance in the turtle language,
except to separate words.


## Everything is a function

The turtle language has no keywords.
Even `forever` is just a function.
It takes a single function as its argument,
and it calls that function again and again
until the game is over or your battery runs down.

Anything wrapped in `{}` is a function.

For example,

    { shoot!, shoot!, shoot! }

is a function that ignores its argument and shoots three times.
You could write the program above like this:

    runAndShoot = {fd 20, rt 10, shoot!},
    forever runAndShoot

Functions can have arguments.

    {x => mul x 2}

is a function that takes a numeric argument and returns
that value times 2.

There are no looping constructs built into the language.
The function `forever` is written like this:

    forever = {f => f!, forever f}

That is, `forever` takes an argument *f* that's a function.
First it calls *f*. Then it calls *forever f* &mdash;that is,
it calls itself.

Infinite recursion is useful!

## Built-in functions

Your turtle has these capabilities.

  * **fd** *number* - Move forward *number* pixels.

  * **lt** *number*, **rt** *number* - Turn left or right *number* degrees.

  * **shoot !** - Fire the frickin' laser beam.

  * **look** *direction* *width* - This very complex function
    controls your turtle's eyes; we dedicate an entire section to it
    below.

In addition, it is excellent at arithmetic.

  * **add**, **sub**, **mul**, **div** - Arithmetic on two numbers.
    For example, `(add 2 2)` returns 4.

  * **neg** *number* - Negate a number, the same as **sub** 0 *number*.

  * **eq?**, **ne?**, **gt?**, **ge?**, **lt?**, **le?** - Comparisons
    on numbers.

The main control flow primitive is the function call, but
there is also **if**:

  * **if** *boolean fn1 fn2* - If the *boolean* argument is true, call
    *fn1*; else call *fn2*. Return the result.

Note that the latter two arguments must be functions! (This is rather
like Tcl, and unlike ML and Haskell.)

You've already met **forever**. There is also something called **while**
and something called **rep**, but of course you could write those
yourself&mdash;they are one-liners.


## Looking

More to come here.

For the time being, here are some useful functions you can write using
**look**.

* **enemyAt?** *d* *w* returns true if looking in the direction *d* (0
  to look straight forward), the nearest thing is the enemy (and not the
  wall).

  <pre><code>enemyAt? = {d w => eq? (head (look d w)) 2},</code></pre>

* **wd** returns the wall distance&mdash;that is, the distance to the
  nearest wall ahead of us.

  A bit of a bug here: if the nearest thing ahead of us happens to be
  the enemy turtle, this just returns an arbitrary big number.

  <pre><code>wd = {
    r = look 0 25,
    if (eq? (head r) 2) {1000} {tail r}
  },</code></pre>


## More examples

This one tries to home in on the enemy. It's a little too complex
though; the behavior is hard to predict.

    see = { d w =>
      eq? (head (look d w)) 2
    },
    forever {
      while { shoot!, see 0 30 } {
        while { see 9 7 } {rt 4},
        while { see 351 7 } {lt 4},
        while { see 2 4 } {rt 1, shoot!, fd 3},
        while { see 358 4 } {lt 1, shoot!, fd 3},
        while { see 0 1 } {shoot!, fd 5}
      },
      while { not (see 0 1) } {
        rt1!
      }
    }

Here is another...

    canSee = {eq? (head (look 0 2)) 2},
    clearance = {tail (look 0 90)},
    forever {
        fd 10,
        rt 2,
        if (lt? (clearance!) 50) {rt 20} {!},
        if (canSee!) {shoot!} {!}
    }

Here is another...

    canSee = {eq? (head (look 0 10)) 2},
    canShoot = {eq? (head (look 0 1)) 2},
    forever {
        if (not (canSee !)) {
            rt 5, shoot!, fd 5
        }{
            if {canShoot!} {
                shoot!,
                while {canShoot!} {
                    shoot!, lt 2
                }
            }{
                rt 1, shoot!
            }
        }
    }


## Changes

The turtle language will evolve. More to come.
