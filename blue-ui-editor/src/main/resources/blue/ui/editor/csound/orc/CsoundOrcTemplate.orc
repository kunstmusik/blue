;Comment
opcode TestOpcode k, k

kval xin

xout kval + 1

endop

/* Comment */
instr 1

iamp  = ampdbfs(-12)
ipch  cps2pch p5, 12

kenv  madsr .1,.05, .95, .4
aout  vco2  kenv * iamp, ipch

aout  moogladder  aout, 5000, .05

outs  aout, aout

endin
