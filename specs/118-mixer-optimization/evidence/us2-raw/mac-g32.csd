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
kG0 = 0.1
kG1 = 0.25
kG2 = 0.4
kG3 = 0.5499999999999999
kG4 = 0.7
kG5 = 0.1
kG6 = 0.25
kG7 = 0.4
kG8 = 0.5499999999999999
kG9 = 0.7
kG10 = 0.1
kG11 = 0.25
kG12 = 0.4
kG13 = 0.5499999999999999
kG14 = 0.7
kG15 = 0.1
kG16 = 0.25
kG17 = 0.4
kG18 = 0.5499999999999999
kG19 = 0.7
kG20 = 0.1
kG21 = 0.25
kG22 = 0.4
kG23 = 0.5499999999999999
kG24 = 0.7
kG25 = 0.1
kG26 = 0.25
kG27 = 0.4
kG28 = 0.5499999999999999
kG29 = 0.7
kG30 = 0.1
kG31 = 0.25
kG32 = 0.4
kG33 = 0.5499999999999999
kG34 = 0.7
kG35 = 0.1
kG36 = 0.25
kG37 = 0.4
kG38 = 0.5499999999999999
kG39 = 0.7
kG40 = 0.1
kG41 = 0.25
kG42 = 0.4
kG43 = 0.5499999999999999
kG44 = 0.7
kG45 = 0.1
kG46 = 0.25
kG47 = 0.4
kG48 = 0.5499999999999999
kG49 = 0.7
kG50 = 0.1
kG51 = 0.25
kG52 = 0.4
kG53 = 0.5499999999999999
kG54 = 0.7
kG55 = 0.1
kG56 = 0.25
kG57 = 0.4
kG58 = 0.5499999999999999
kG59 = 0.7
kG60 = 0.1
kG61 = 0.25
kG62 = 0.4
kG63 = 0.5499999999999999
kG64 = 0.7
kG65 = 0.1
kG66 = 0.25
kG67 = 0.4
kG68 = 0.5499999999999999
kG69 = 0.7
kG70 = 0.1
kG71 = 0.25
kG72 = 0.4
kG73 = 0.5499999999999999
kG74 = 0.7
kG75 = 0.1
kG76 = 0.25
kG77 = 0.4
kG78 = 0.5499999999999999
kG79 = 0.7
kG80 = 0.1
kG81 = 0.25
kG82 = 0.4
kG83 = 0.5499999999999999
kG84 = 0.7
kG85 = 0.1
kG86 = 0.25
kG87 = 0.4
kG88 = 0.5499999999999999
kG89 = 0.7
kG90 = 0.1
kG91 = 0.25
kG92 = 0.4
kG93 = 0.5499999999999999
kG94 = 0.7
kG95 = 0.1
kG96 = 0.25
kG97 = 0.4
kG98 = 0.5499999999999999
kG99 = 0.7
kG100 = 0.1
kG101 = 0.25
kG102 = 0.4
kG103 = 0.5499999999999999
kG104 = 0.7
kG105 = 0.1
kG106 = 0.25
kG107 = 0.4
kG108 = 0.5499999999999999
kG109 = 0.7
kG110 = 0.1
kG111 = 0.25
kG112 = 0.4
kG113 = 0.5499999999999999
kG114 = 0.7
kG115 = 0.1
kG116 = 0.25
kG117 = 0.4
kG118 = 0.5499999999999999
kG119 = 0.7
kG120 = 0.1
kG121 = 0.25
kG122 = 0.4
kG123 = 0.5499999999999999
kG124 = 0.7
kG125 = 0.1
kG126 = 0.25
kG127 = 0.4
gaBus0_0 mac kG0, aSrc0_0, kG1, aSrc1_0, kG2, aSrc2_0, kG3, aSrc3_0, kG4, aSrc4_0, kG5, aSrc5_0, kG6, aSrc6_0, kG7, aSrc7_0, kG8, aSrc8_0, kG9, aSrc9_0, kG10, aSrc10_0, kG11, aSrc11_0, kG12, aSrc12_0, kG13, aSrc13_0, kG14, aSrc14_0, kG15, aSrc15_0, kG16, aSrc16_0, kG17, aSrc17_0, kG18, aSrc18_0, kG19, aSrc19_0, kG20, aSrc20_0, kG21, aSrc21_0, kG22, aSrc22_0, kG23, aSrc23_0, kG24, aSrc24_0, kG25, aSrc25_0, kG26, aSrc26_0, kG27, aSrc27_0, kG28, aSrc28_0, kG29, aSrc29_0, kG30, aSrc30_0, kG31, aSrc31_0
gaBus0_1 mac kG0, aSrc0_1, kG1, aSrc1_1, kG2, aSrc2_1, kG3, aSrc3_1, kG4, aSrc4_1, kG5, aSrc5_1, kG6, aSrc6_1, kG7, aSrc7_1, kG8, aSrc8_1, kG9, aSrc9_1, kG10, aSrc10_1, kG11, aSrc11_1, kG12, aSrc12_1, kG13, aSrc13_1, kG14, aSrc14_1, kG15, aSrc15_1, kG16, aSrc16_1, kG17, aSrc17_1, kG18, aSrc18_1, kG19, aSrc19_1, kG20, aSrc20_1, kG21, aSrc21_1, kG22, aSrc22_1, kG23, aSrc23_1, kG24, aSrc24_1, kG25, aSrc25_1, kG26, aSrc26_1, kG27, aSrc27_1, kG28, aSrc28_1, kG29, aSrc29_1, kG30, aSrc30_1, kG31, aSrc31_1
gaBus1_0 mac kG32, aSrc32_0, kG33, aSrc33_0, kG34, aSrc34_0, kG35, aSrc35_0, kG36, aSrc36_0, kG37, aSrc37_0, kG38, aSrc38_0, kG39, aSrc39_0, kG40, aSrc40_0, kG41, aSrc41_0, kG42, aSrc42_0, kG43, aSrc43_0, kG44, aSrc44_0, kG45, aSrc45_0, kG46, aSrc46_0, kG47, aSrc47_0, kG48, aSrc48_0, kG49, aSrc49_0, kG50, aSrc50_0, kG51, aSrc51_0, kG52, aSrc52_0, kG53, aSrc53_0, kG54, aSrc54_0, kG55, aSrc55_0, kG56, aSrc56_0, kG57, aSrc57_0, kG58, aSrc58_0, kG59, aSrc59_0, kG60, aSrc60_0, kG61, aSrc61_0, kG62, aSrc62_0, kG63, aSrc63_0
gaBus1_1 mac kG32, aSrc32_1, kG33, aSrc33_1, kG34, aSrc34_1, kG35, aSrc35_1, kG36, aSrc36_1, kG37, aSrc37_1, kG38, aSrc38_1, kG39, aSrc39_1, kG40, aSrc40_1, kG41, aSrc41_1, kG42, aSrc42_1, kG43, aSrc43_1, kG44, aSrc44_1, kG45, aSrc45_1, kG46, aSrc46_1, kG47, aSrc47_1, kG48, aSrc48_1, kG49, aSrc49_1, kG50, aSrc50_1, kG51, aSrc51_1, kG52, aSrc52_1, kG53, aSrc53_1, kG54, aSrc54_1, kG55, aSrc55_1, kG56, aSrc56_1, kG57, aSrc57_1, kG58, aSrc58_1, kG59, aSrc59_1, kG60, aSrc60_1, kG61, aSrc61_1, kG62, aSrc62_1, kG63, aSrc63_1
gaBus2_0 mac kG64, aSrc64_0, kG65, aSrc65_0, kG66, aSrc66_0, kG67, aSrc67_0, kG68, aSrc68_0, kG69, aSrc69_0, kG70, aSrc70_0, kG71, aSrc71_0, kG72, aSrc72_0, kG73, aSrc73_0, kG74, aSrc74_0, kG75, aSrc75_0, kG76, aSrc76_0, kG77, aSrc77_0, kG78, aSrc78_0, kG79, aSrc79_0, kG80, aSrc80_0, kG81, aSrc81_0, kG82, aSrc82_0, kG83, aSrc83_0, kG84, aSrc84_0, kG85, aSrc85_0, kG86, aSrc86_0, kG87, aSrc87_0, kG88, aSrc88_0, kG89, aSrc89_0, kG90, aSrc90_0, kG91, aSrc91_0, kG92, aSrc92_0, kG93, aSrc93_0, kG94, aSrc94_0, kG95, aSrc95_0
gaBus2_1 mac kG64, aSrc64_1, kG65, aSrc65_1, kG66, aSrc66_1, kG67, aSrc67_1, kG68, aSrc68_1, kG69, aSrc69_1, kG70, aSrc70_1, kG71, aSrc71_1, kG72, aSrc72_1, kG73, aSrc73_1, kG74, aSrc74_1, kG75, aSrc75_1, kG76, aSrc76_1, kG77, aSrc77_1, kG78, aSrc78_1, kG79, aSrc79_1, kG80, aSrc80_1, kG81, aSrc81_1, kG82, aSrc82_1, kG83, aSrc83_1, kG84, aSrc84_1, kG85, aSrc85_1, kG86, aSrc86_1, kG87, aSrc87_1, kG88, aSrc88_1, kG89, aSrc89_1, kG90, aSrc90_1, kG91, aSrc91_1, kG92, aSrc92_1, kG93, aSrc93_1, kG94, aSrc94_1, kG95, aSrc95_1
gaBus3_0 mac kG96, aSrc96_0, kG97, aSrc97_0, kG98, aSrc98_0, kG99, aSrc99_0, kG100, aSrc100_0, kG101, aSrc101_0, kG102, aSrc102_0, kG103, aSrc103_0, kG104, aSrc104_0, kG105, aSrc105_0, kG106, aSrc106_0, kG107, aSrc107_0, kG108, aSrc108_0, kG109, aSrc109_0, kG110, aSrc110_0, kG111, aSrc111_0, kG112, aSrc112_0, kG113, aSrc113_0, kG114, aSrc114_0, kG115, aSrc115_0, kG116, aSrc116_0, kG117, aSrc117_0, kG118, aSrc118_0, kG119, aSrc119_0, kG120, aSrc120_0, kG121, aSrc121_0, kG122, aSrc122_0, kG123, aSrc123_0, kG124, aSrc124_0, kG125, aSrc125_0, kG126, aSrc126_0, kG127, aSrc127_0
gaBus3_1 mac kG96, aSrc96_1, kG97, aSrc97_1, kG98, aSrc98_1, kG99, aSrc99_1, kG100, aSrc100_1, kG101, aSrc101_1, kG102, aSrc102_1, kG103, aSrc103_1, kG104, aSrc104_1, kG105, aSrc105_1, kG106, aSrc106_1, kG107, aSrc107_1, kG108, aSrc108_1, kG109, aSrc109_1, kG110, aSrc110_1, kG111, aSrc111_1, kG112, aSrc112_1, kG113, aSrc113_1, kG114, aSrc114_1, kG115, aSrc115_1, kG116, aSrc116_1, kG117, aSrc117_1, kG118, aSrc118_1, kG119, aSrc119_1, kG120, aSrc120_1, kG121, aSrc121_1, kG122, aSrc122_1, kG123, aSrc123_1, kG124, aSrc124_1, kG125, aSrc125_1, kG126, aSrc126_1, kG127, aSrc127_1
gaMaster_0	+=	gaBus0_0
gaMaster_1	+=	gaBus0_1
gaMaster_0	+=	gaBus1_0
gaMaster_1	+=	gaBus1_1
gaMaster_0	+=	gaBus2_0
gaMaster_1	+=	gaBus2_1
gaMaster_0	+=	gaBus3_0
gaMaster_1	+=	gaBus3_1
gaMaster_0	+=	gaBus4_0
gaMaster_1	+=	gaBus4_1
gaMaster_0	+=	gaBus5_0
gaMaster_1	+=	gaBus5_1
gaMaster_0	+=	gaBus6_0
gaMaster_1	+=	gaBus6_1
gaMaster_0	+=	gaBus7_0
gaMaster_1	+=	gaBus7_1
outc gaMaster_0, gaMaster_1
clear gaBus0_0, gaBus0_1, gaBus1_0, gaBus1_1, gaBus2_0, gaBus2_1, gaBus3_0, gaBus3_1, gaBus4_0, gaBus4_1, gaBus5_0, gaBus5_1, gaBus6_0, gaBus6_1, gaBus7_0, gaBus7_1, gaMaster_0, gaMaster_1
endin

</CsInstruments>
<CsScore>
i"Mixer" 0 60
e
</CsScore>
</CsoundSynthesizer>
