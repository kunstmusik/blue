package de.torq.clojure.jsr223;

import javax.script.Bindings;
import java.util.HashMap;
import java.util.Map;

import clojure.lang.Associative;
import clojure.lang.PersistentHashMap;
import clojure.lang.RT;
import clojure.lang.Var;
import clojure.lang.Symbol;

// TODO:
// - support fully qualified names (as desribed in JSR 223 released version, p. 141)
public class ClojureBindings extends HashMap<String, Object>
                             implements Bindings
{

    public static final String nsUser = "user";
    public static final String nsClojure = "clojure.core";

    public ClojureBindings()
    {
        super();
    }

    public ClojureBindings(Associative a)
    {
        super();
    }

    /* Convert an arbitrary Bindings-implementation to an Associative-instance
     * (since JSR223 demands that we are able to accept any * Bindings-implementation.
     *
     * NOTE: Due to thread-local vars, this must be called on the correct thread!
     */
    public static Associative toAssociative(Bindings b, Symbol ns)
    {
        Associative result = PersistentHashMap.create();
        for (Map.Entry<String, Object> e : b.entrySet())
        {
            // This will create a root binding if one does not exist. Purely
            // thread-local definitions are not possible in Clojure (or Java).
            // TODO: We could let the root binding unbound (excuse the confuse
            // terminology) by passing null to RT.var. This would prevent sharing
            // between ClojureScriptEngine-instances by throwing an
            // IllegalStateException when trying to get the value of the var,
            // but that's a matter of taste, I think.
            Var var = RT.var(ns.getName(), e.getKey(), e.getValue());
            result = result.assoc(var, e.getValue());
        }

        return result;
    }
}

