#!/bin/sh

mkdir -p src/blue/ui/editor/clojure/antlr
antlr-3.4 grammar/Clojure.g -o src/blue/ui/editor/clojure/antlr
