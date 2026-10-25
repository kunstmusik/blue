<CsoundSynthesizer>
<CsInstruments>
sr=44100
ksmps=32
nchnls=2
0dbfs=1

gaBus0_0 init 0
gaBus0_1 init 0
gaBus1_0 init 0
gaBus1_1 init 0
gaBus2_0 init 0
gaBus2_1 init 0
gaBus3_0 init 0
gaBus3_1 init 0
gaBus4_0 init 0
gaBus4_1 init 0
gaBus5_0 init 0
gaBus5_1 init 0
gaBus6_0 init 0
gaBus6_1 init 0
gaBus7_0 init 0
gaBus7_1 init 0
gaMaster_0 init 0
gaMaster_1 init 0
gaDirect_0 init 0
gaDirect_1 init 0

instr Mixer
aSrc0_0 oscili 0.05, 150, -1
aSrc0_1 oscili 0.05, 153, -1
aSrc1_0 oscili 0.05, 157, -1
aSrc1_1 oscili 0.05, 160, -1
aSrc2_0 oscili 0.05, 164, -1
aSrc2_1 oscili 0.05, 167, -1
aSrc3_0 oscili 0.05, 171, -1
aSrc3_1 oscili 0.05, 174, -1
aSrc4_0 oscili 0.05, 178, -1
aSrc4_1 oscili 0.05, 181, -1
aSrc5_0 oscili 0.05, 185, -1
aSrc5_1 oscili 0.05, 188, -1
aSrc6_0 oscili 0.05, 192, -1
aSrc6_1 oscili 0.05, 195, -1
aSrc7_0 oscili 0.05, 199, -1
aSrc7_1 oscili 0.05, 202, -1
aSrc8_0 oscili 0.05, 206, -1
aSrc8_1 oscili 0.05, 209, -1
aSrc9_0 oscili 0.05, 213, -1
aSrc9_1 oscili 0.05, 216, -1
aSrc10_0 oscili 0.05, 220, -1
aSrc10_1 oscili 0.05, 223, -1
aSrc11_0 oscili 0.05, 227, -1
aSrc11_1 oscili 0.05, 230, -1
aSrc12_0 oscili 0.05, 234, -1
aSrc12_1 oscili 0.05, 237, -1
aSrc13_0 oscili 0.05, 241, -1
aSrc13_1 oscili 0.05, 244, -1
aSrc14_0 oscili 0.05, 248, -1
aSrc14_1 oscili 0.05, 251, -1
aSrc15_0 oscili 0.05, 255, -1
aSrc15_1 oscili 0.05, 258, -1
aSrc16_0 oscili 0.05, 262, -1
aSrc16_1 oscili 0.05, 265, -1
aSrc17_0 oscili 0.05, 269, -1
aSrc17_1 oscili 0.05, 272, -1
aSrc18_0 oscili 0.05, 276, -1
aSrc18_1 oscili 0.05, 279, -1
aSrc19_0 oscili 0.05, 283, -1
aSrc19_1 oscili 0.05, 286, -1
aSrc20_0 oscili 0.05, 290, -1
aSrc20_1 oscili 0.05, 293, -1
aSrc21_0 oscili 0.05, 297, -1
aSrc21_1 oscili 0.05, 300, -1
aSrc22_0 oscili 0.05, 304, -1
aSrc22_1 oscili 0.05, 307, -1
aSrc23_0 oscili 0.05, 311, -1
aSrc23_1 oscili 0.05, 314, -1
aSrc24_0 oscili 0.05, 318, -1
aSrc24_1 oscili 0.05, 321, -1
aSrc25_0 oscili 0.05, 325, -1
aSrc25_1 oscili 0.05, 328, -1
aSrc26_0 oscili 0.05, 332, -1
aSrc26_1 oscili 0.05, 335, -1
aSrc27_0 oscili 0.05, 339, -1
aSrc27_1 oscili 0.05, 342, -1
aSrc28_0 oscili 0.05, 346, -1
aSrc28_1 oscili 0.05, 349, -1
aSrc29_0 oscili 0.05, 353, -1
aSrc29_1 oscili 0.05, 356, -1
aSrc30_0 oscili 0.05, 360, -1
aSrc30_1 oscili 0.05, 363, -1
aSrc31_0 oscili 0.05, 367, -1
aSrc31_1 oscili 0.05, 370, -1
aSrc32_0 oscili 0.05, 374, -1
aSrc32_1 oscili 0.05, 377, -1
aSrc33_0 oscili 0.05, 381, -1
aSrc33_1 oscili 0.05, 384, -1
aSrc34_0 oscili 0.05, 388, -1
aSrc34_1 oscili 0.05, 391, -1
aSrc35_0 oscili 0.05, 395, -1
aSrc35_1 oscili 0.05, 398, -1
aSrc36_0 oscili 0.05, 402, -1
aSrc36_1 oscili 0.05, 405, -1
aSrc37_0 oscili 0.05, 409, -1
aSrc37_1 oscili 0.05, 412, -1
aSrc38_0 oscili 0.05, 416, -1
aSrc38_1 oscili 0.05, 419, -1
aSrc39_0 oscili 0.05, 423, -1
aSrc39_1 oscili 0.05, 426, -1
aSrc40_0 oscili 0.05, 430, -1
aSrc40_1 oscili 0.05, 433, -1
aSrc41_0 oscili 0.05, 437, -1
aSrc41_1 oscili 0.05, 440, -1
aSrc42_0 oscili 0.05, 444, -1
aSrc42_1 oscili 0.05, 447, -1
aSrc43_0 oscili 0.05, 451, -1
aSrc43_1 oscili 0.05, 454, -1
aSrc44_0 oscili 0.05, 458, -1
aSrc44_1 oscili 0.05, 461, -1
aSrc45_0 oscili 0.05, 465, -1
aSrc45_1 oscili 0.05, 468, -1
aSrc46_0 oscili 0.05, 472, -1
aSrc46_1 oscili 0.05, 475, -1
aSrc47_0 oscili 0.05, 479, -1
aSrc47_1 oscili 0.05, 482, -1
aSrc48_0 oscili 0.05, 486, -1
aSrc48_1 oscili 0.05, 489, -1
aSrc49_0 oscili 0.05, 493, -1
aSrc49_1 oscili 0.05, 496, -1
aSrc50_0 oscili 0.05, 500, -1
aSrc50_1 oscili 0.05, 503, -1
aSrc51_0 oscili 0.05, 507, -1
aSrc51_1 oscili 0.05, 510, -1
aSrc52_0 oscili 0.05, 514, -1
aSrc52_1 oscili 0.05, 517, -1
aSrc53_0 oscili 0.05, 521, -1
aSrc53_1 oscili 0.05, 524, -1
aSrc54_0 oscili 0.05, 528, -1
aSrc54_1 oscili 0.05, 531, -1
aSrc55_0 oscili 0.05, 535, -1
aSrc55_1 oscili 0.05, 538, -1
aSrc56_0 oscili 0.05, 542, -1
aSrc56_1 oscili 0.05, 545, -1
aSrc57_0 oscili 0.05, 549, -1
aSrc57_1 oscili 0.05, 552, -1
aSrc58_0 oscili 0.05, 556, -1
aSrc58_1 oscili 0.05, 559, -1
aSrc59_0 oscili 0.05, 563, -1
aSrc59_1 oscili 0.05, 566, -1
aSrc60_0 oscili 0.05, 570, -1
aSrc60_1 oscili 0.05, 573, -1
aSrc61_0 oscili 0.05, 577, -1
aSrc61_1 oscili 0.05, 580, -1
aSrc62_0 oscili 0.05, 584, -1
aSrc62_1 oscili 0.05, 587, -1
aSrc63_0 oscili 0.05, 591, -1
aSrc63_1 oscili 0.05, 594, -1
aSrc64_0 oscili 0.05, 598, -1
aSrc64_1 oscili 0.05, 601, -1
aSrc65_0 oscili 0.05, 605, -1
aSrc65_1 oscili 0.05, 608, -1
aSrc66_0 oscili 0.05, 612, -1
aSrc66_1 oscili 0.05, 615, -1
aSrc67_0 oscili 0.05, 619, -1
aSrc67_1 oscili 0.05, 622, -1
aSrc68_0 oscili 0.05, 626, -1
aSrc68_1 oscili 0.05, 629, -1
aSrc69_0 oscili 0.05, 633, -1
aSrc69_1 oscili 0.05, 636, -1
aSrc70_0 oscili 0.05, 640, -1
aSrc70_1 oscili 0.05, 643, -1
aSrc71_0 oscili 0.05, 647, -1
aSrc71_1 oscili 0.05, 650, -1
aSrc72_0 oscili 0.05, 654, -1
aSrc72_1 oscili 0.05, 657, -1
aSrc73_0 oscili 0.05, 661, -1
aSrc73_1 oscili 0.05, 664, -1
aSrc74_0 oscili 0.05, 668, -1
aSrc74_1 oscili 0.05, 671, -1
aSrc75_0 oscili 0.05, 675, -1
aSrc75_1 oscili 0.05, 678, -1
aSrc76_0 oscili 0.05, 682, -1
aSrc76_1 oscili 0.05, 685, -1
aSrc77_0 oscili 0.05, 689, -1
aSrc77_1 oscili 0.05, 692, -1
aSrc78_0 oscili 0.05, 696, -1
aSrc78_1 oscili 0.05, 699, -1
aSrc79_0 oscili 0.05, 703, -1
aSrc79_1 oscili 0.05, 706, -1
aSrc80_0 oscili 0.05, 710, -1
aSrc80_1 oscili 0.05, 713, -1
aSrc81_0 oscili 0.05, 717, -1
aSrc81_1 oscili 0.05, 720, -1
aSrc82_0 oscili 0.05, 724, -1
aSrc82_1 oscili 0.05, 727, -1
aSrc83_0 oscili 0.05, 731, -1
aSrc83_1 oscili 0.05, 734, -1
aSrc84_0 oscili 0.05, 738, -1
aSrc84_1 oscili 0.05, 741, -1
aSrc85_0 oscili 0.05, 745, -1
aSrc85_1 oscili 0.05, 748, -1
aSrc86_0 oscili 0.05, 752, -1
aSrc86_1 oscili 0.05, 755, -1
aSrc87_0 oscili 0.05, 759, -1
aSrc87_1 oscili 0.05, 762, -1
aSrc88_0 oscili 0.05, 766, -1
aSrc88_1 oscili 0.05, 769, -1
aSrc89_0 oscili 0.05, 773, -1
aSrc89_1 oscili 0.05, 776, -1
aSrc90_0 oscili 0.05, 780, -1
aSrc90_1 oscili 0.05, 783, -1
aSrc91_0 oscili 0.05, 787, -1
aSrc91_1 oscili 0.05, 790, -1
aSrc92_0 oscili 0.05, 794, -1
aSrc92_1 oscili 0.05, 797, -1
aSrc93_0 oscili 0.05, 801, -1
aSrc93_1 oscili 0.05, 804, -1
aSrc94_0 oscili 0.05, 808, -1
aSrc94_1 oscili 0.05, 811, -1
aSrc95_0 oscili 0.05, 815, -1
aSrc95_1 oscili 0.05, 818, -1
aSrc96_0 oscili 0.05, 822, -1
aSrc96_1 oscili 0.05, 825, -1
aSrc97_0 oscili 0.05, 829, -1
aSrc97_1 oscili 0.05, 832, -1
aSrc98_0 oscili 0.05, 836, -1
aSrc98_1 oscili 0.05, 839, -1
aSrc99_0 oscili 0.05, 843, -1
aSrc99_1 oscili 0.05, 846, -1
aSrc100_0 oscili 0.05, 850, -1
aSrc100_1 oscili 0.05, 853, -1
aSrc101_0 oscili 0.05, 857, -1
aSrc101_1 oscili 0.05, 860, -1
aSrc102_0 oscili 0.05, 864, -1
aSrc102_1 oscili 0.05, 867, -1
aSrc103_0 oscili 0.05, 871, -1
aSrc103_1 oscili 0.05, 874, -1
aSrc104_0 oscili 0.05, 878, -1
aSrc104_1 oscili 0.05, 881, -1
aSrc105_0 oscili 0.05, 885, -1
aSrc105_1 oscili 0.05, 888, -1
aSrc106_0 oscili 0.05, 892, -1
aSrc106_1 oscili 0.05, 895, -1
aSrc107_0 oscili 0.05, 899, -1
aSrc107_1 oscili 0.05, 902, -1
aSrc108_0 oscili 0.05, 906, -1
aSrc108_1 oscili 0.05, 909, -1
aSrc109_0 oscili 0.05, 913, -1
aSrc109_1 oscili 0.05, 916, -1
aSrc110_0 oscili 0.05, 920, -1
aSrc110_1 oscili 0.05, 923, -1
aSrc111_0 oscili 0.05, 927, -1
aSrc111_1 oscili 0.05, 930, -1
aSrc112_0 oscili 0.05, 934, -1
aSrc112_1 oscili 0.05, 937, -1
aSrc113_0 oscili 0.05, 941, -1
aSrc113_1 oscili 0.05, 944, -1
aSrc114_0 oscili 0.05, 948, -1
aSrc114_1 oscili 0.05, 951, -1
aSrc115_0 oscili 0.05, 955, -1
aSrc115_1 oscili 0.05, 958, -1
aSrc116_0 oscili 0.05, 962, -1
aSrc116_1 oscili 0.05, 965, -1
aSrc117_0 oscili 0.05, 969, -1
aSrc117_1 oscili 0.05, 972, -1
aSrc118_0 oscili 0.05, 976, -1
aSrc118_1 oscili 0.05, 979, -1
aSrc119_0 oscili 0.05, 983, -1
aSrc119_1 oscili 0.05, 986, -1
aSrc120_0 oscili 0.05, 990, -1
aSrc120_1 oscili 0.05, 993, -1
aSrc121_0 oscili 0.05, 997, -1
aSrc121_1 oscili 0.05, 1000, -1
aSrc122_0 oscili 0.05, 1004, -1
aSrc122_1 oscili 0.05, 1007, -1
aSrc123_0 oscili 0.05, 1011, -1
aSrc123_1 oscili 0.05, 1014, -1
aSrc124_0 oscili 0.05, 1018, -1
aSrc124_1 oscili 0.05, 1021, -1
aSrc125_0 oscili 0.05, 1025, -1
aSrc125_1 oscili 0.05, 1028, -1
aSrc126_0 oscili 0.05, 1032, -1
aSrc126_1 oscili 0.05, 1035, -1
aSrc127_0 oscili 0.05, 1039, -1
aSrc127_1 oscili 0.05, 1042, -1
aDirect_0 oscili 0.05, 90, -1
aDirect_1 oscili 0.05, 91, -1
gaBus0_0 sum gaBus0_0, aSrc0_0, aSrc1_0, aSrc2_0, aSrc3_0, aSrc4_0, aSrc5_0, aSrc6_0, aSrc7_0, aSrc8_0, aSrc9_0, aSrc10_0, aSrc11_0, aSrc12_0, aSrc13_0, aSrc14_0, aSrc15_0, aSrc16_0, aSrc17_0, aSrc18_0, aSrc19_0, aSrc20_0, aSrc21_0, aSrc22_0, aSrc23_0, aSrc24_0, aSrc25_0, aSrc26_0, aSrc27_0, aSrc28_0, aSrc29_0, aSrc30_0, aSrc31_0
gaBus0_1 sum gaBus0_1, aSrc0_1, aSrc1_1, aSrc2_1, aSrc3_1, aSrc4_1, aSrc5_1, aSrc6_1, aSrc7_1, aSrc8_1, aSrc9_1, aSrc10_1, aSrc11_1, aSrc12_1, aSrc13_1, aSrc14_1, aSrc15_1, aSrc16_1, aSrc17_1, aSrc18_1, aSrc19_1, aSrc20_1, aSrc21_1, aSrc22_1, aSrc23_1, aSrc24_1, aSrc25_1, aSrc26_1, aSrc27_1, aSrc28_1, aSrc29_1, aSrc30_1, aSrc31_1
gaBus1_0 sum gaBus1_0, aSrc32_0, aSrc33_0, aSrc34_0, aSrc35_0, aSrc36_0, aSrc37_0, aSrc38_0, aSrc39_0, aSrc40_0, aSrc41_0, aSrc42_0, aSrc43_0, aSrc44_0, aSrc45_0, aSrc46_0, aSrc47_0, aSrc48_0, aSrc49_0, aSrc50_0, aSrc51_0, aSrc52_0, aSrc53_0, aSrc54_0, aSrc55_0, aSrc56_0, aSrc57_0, aSrc58_0, aSrc59_0, aSrc60_0, aSrc61_0, aSrc62_0, aSrc63_0
gaBus1_1 sum gaBus1_1, aSrc32_1, aSrc33_1, aSrc34_1, aSrc35_1, aSrc36_1, aSrc37_1, aSrc38_1, aSrc39_1, aSrc40_1, aSrc41_1, aSrc42_1, aSrc43_1, aSrc44_1, aSrc45_1, aSrc46_1, aSrc47_1, aSrc48_1, aSrc49_1, aSrc50_1, aSrc51_1, aSrc52_1, aSrc53_1, aSrc54_1, aSrc55_1, aSrc56_1, aSrc57_1, aSrc58_1, aSrc59_1, aSrc60_1, aSrc61_1, aSrc62_1, aSrc63_1
gaBus2_0 sum gaBus2_0, aSrc64_0, aSrc65_0, aSrc66_0, aSrc67_0, aSrc68_0, aSrc69_0, aSrc70_0, aSrc71_0, aSrc72_0, aSrc73_0, aSrc74_0, aSrc75_0, aSrc76_0, aSrc77_0, aSrc78_0, aSrc79_0, aSrc80_0, aSrc81_0, aSrc82_0, aSrc83_0, aSrc84_0, aSrc85_0, aSrc86_0, aSrc87_0, aSrc88_0, aSrc89_0, aSrc90_0, aSrc91_0, aSrc92_0, aSrc93_0, aSrc94_0, aSrc95_0
gaBus2_1 sum gaBus2_1, aSrc64_1, aSrc65_1, aSrc66_1, aSrc67_1, aSrc68_1, aSrc69_1, aSrc70_1, aSrc71_1, aSrc72_1, aSrc73_1, aSrc74_1, aSrc75_1, aSrc76_1, aSrc77_1, aSrc78_1, aSrc79_1, aSrc80_1, aSrc81_1, aSrc82_1, aSrc83_1, aSrc84_1, aSrc85_1, aSrc86_1, aSrc87_1, aSrc88_1, aSrc89_1, aSrc90_1, aSrc91_1, aSrc92_1, aSrc93_1, aSrc94_1, aSrc95_1
gaBus3_0 sum gaBus3_0, aSrc96_0, aSrc97_0, aSrc98_0, aSrc99_0, aSrc100_0, aSrc101_0, aSrc102_0, aSrc103_0, aSrc104_0, aSrc105_0, aSrc106_0, aSrc107_0, aSrc108_0, aSrc109_0, aSrc110_0, aSrc111_0, aSrc112_0, aSrc113_0, aSrc114_0, aSrc115_0, aSrc116_0, aSrc117_0, aSrc118_0, aSrc119_0, aSrc120_0, aSrc121_0, aSrc122_0, aSrc123_0, aSrc124_0, aSrc125_0, aSrc126_0, aSrc127_0
gaBus3_1 sum gaBus3_1, aSrc96_1, aSrc97_1, aSrc98_1, aSrc99_1, aSrc100_1, aSrc101_1, aSrc102_1, aSrc103_1, aSrc104_1, aSrc105_1, aSrc106_1, aSrc107_1, aSrc108_1, aSrc109_1, aSrc110_1, aSrc111_1, aSrc112_1, aSrc113_1, aSrc114_1, aSrc115_1, aSrc116_1, aSrc117_1, aSrc118_1, aSrc119_1, aSrc120_1, aSrc121_1, aSrc122_1, aSrc123_1, aSrc124_1, aSrc125_1, aSrc126_1, aSrc127_1
gaMaster_0	+=	gaBus0_0 + gaDirect_0
gaMaster_1	+=	gaBus0_1 + gaDirect_1
gaMaster_0	+=	gaBus1_0 + gaDirect_0
gaMaster_1	+=	gaBus1_1 + gaDirect_1
gaMaster_0	+=	gaBus2_0 + gaDirect_0
gaMaster_1	+=	gaBus2_1 + gaDirect_1
gaMaster_0	+=	gaBus3_0 + gaDirect_0
gaMaster_1	+=	gaBus3_1 + gaDirect_1
gaMaster_0	+=	gaBus4_0 + gaDirect_0
gaMaster_1	+=	gaBus4_1 + gaDirect_1
gaMaster_0	+=	gaBus5_0 + gaDirect_0
gaMaster_1	+=	gaBus5_1 + gaDirect_1
gaMaster_0	+=	gaBus6_0 + gaDirect_0
gaMaster_1	+=	gaBus6_1 + gaDirect_1
gaMaster_0	+=	gaBus7_0 + gaDirect_0
gaMaster_1	+=	gaBus7_1 + gaDirect_1
outc gaMaster_0, gaMaster_1
clear gaBus0_0, gaBus0_1, gaBus1_0, gaBus1_1, gaBus2_0, gaBus2_1, gaBus3_0, gaBus3_1, gaBus4_0, gaBus4_1, gaBus5_0, gaBus5_1, gaBus6_0, gaBus6_1, gaBus7_0, gaBus7_1, gaMaster_0, gaMaster_1
endin

</CsInstruments>
<CsScore>
i"Mixer" 0 60
e
</CsScore>
</CsoundSynthesizer>
