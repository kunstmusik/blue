#!/bin/sh
for i in *.dot 
do
	dot -Tpng $i -o diagram_`basename -s .dot $i`.png
done
