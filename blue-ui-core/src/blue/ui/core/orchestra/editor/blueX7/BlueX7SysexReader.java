package blue.ui.core.orchestra.editor.blueX7;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

import blue.orchestra.BlueX7;
import blue.orchestra.blueX7.Operator;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class BlueX7SysexReader {
    public static final int SINGLE = 0;

    public static final int BANK = 1;

    public static final int START_OFFSET = 6;

    public static final int NAME_OFFSET = 118;

    public BlueX7SysexReader() {
    }

    public static int getSysexType(byte[] sysex) {
        if (sysex.length == 4104) {
            return BANK;
        }
        if (sysex.length == 163) {
            return SINGLE;
        }

        return -1;
    }

    public static String[] getNameListFromBank(byte[] sysex) {
        String[] names = new String[32];

        for (int i = 0; i < 32; i++) {
            names[i] = "";

            for (int j = 0; j < 10; j++) {
                names[i] += (char) (sysex[(128 * i) + NAME_OFFSET
                        + START_OFFSET + j]);
            }
            // System.out.println("name " + i + " : " + names[i]);
        }
        return names;
    }

    public static final void importFromSinglePatch(BlueX7 blueX7, byte[] sysex) {
        for (int i = 0; i < 6; i++) {
            mapOperatorFromSingle(blueX7, sysex, i);
        }

        int offset = START_OFFSET; // gets us past the header
        offset += 126; // gets us past the operator bytes

        // bytes 126 - 133
        blueX7.peg[0].x = sysex[offset++];
        blueX7.peg[1].x = sysex[offset++];
        blueX7.peg[2].x = sysex[offset++];
        blueX7.peg[3].x = sysex[offset++];
        blueX7.peg[0].y = sysex[offset++];
        blueX7.peg[1].y = sysex[offset++];
        blueX7.peg[2].y = sysex[offset++];
        blueX7.peg[3].y = sysex[offset++];

        // byte 134
        blueX7.algorithmCommon.algorithm = sysex[offset++] + 1;

        // byte 135-136
        blueX7.algorithmCommon.feedback = sysex[offset++];
        int temp = sysex[offset++];

        for (int i = 0; i < blueX7.operators.length; i++) {
            blueX7.operators[i].sync = temp;
        }

        // byte 137 - 142
        blueX7.lfo.speed = sysex[offset++];
        blueX7.lfo.delay = sysex[offset++];
        blueX7.lfo.PMD = sysex[offset++];
        blueX7.lfo.AMD = sysex[offset++];
        blueX7.lfo.sync = sysex[offset++];
        blueX7.lfo.wave = sysex[offset++];

        // byte 143
        temp = sysex[offset++];

        for (int i = 0; i < blueX7.operators.length; i++) {
            blueX7.operators[i].modulationPitch = temp;
        }

        // byte 144
        blueX7.algorithmCommon.keyTranspose = sysex[offset++];

        // byte 155
        temp = sysex[offset + 10];

        /*
         * System.out.println("operators: " + temp);
         * 
         * blueX7.algorithmCommon.operators[0] = (temp & 32) > 0;
         * blueX7.algorithmCommon.operators[1] = (temp & 16) > 0;
         * blueX7.algorithmCommon.operators[2] = (temp & 8) > 0;
         * blueX7.algorithmCommon.operators[3] = (temp & 4) > 0;
         * blueX7.algorithmCommon.operators[4] = (temp & 2) > 0;
         * blueX7.algorithmCommon.operators[5] = (temp & 1) > 0;
         */

        for (int i = 0; i < blueX7.algorithmCommon.operators.length; i++) {
            blueX7.algorithmCommon.operators[i] = true;
        }
    }

    public static final void importFromBank(BlueX7 blueX7, byte[] sysex,
            int patchNum) {
        for (int i = 0; i < 6; i++) {
            mapOperatorFromBank(blueX7, sysex, patchNum, i);
        }

        int offset = START_OFFSET; // gets us past the header
        offset += patchNum * 128; // gets us to the patch we're interested in
        offset += 102; // gets us past the operator bytes

        // bytes 102 - 109
        blueX7.peg[0].x = sysex[offset++];
        blueX7.peg[1].x = sysex[offset++];
        blueX7.peg[2].x = sysex[offset++];
        blueX7.peg[3].x = sysex[offset++];
        blueX7.peg[0].y = sysex[offset++];
        blueX7.peg[1].y = sysex[offset++];
        blueX7.peg[2].y = sysex[offset++];
        blueX7.peg[3].y = sysex[offset++];

        // byte 110
        blueX7.algorithmCommon.algorithm = sysex[offset++] + 1;

        // byte 111
        int temp = sysex[offset++];
        int val1 = temp & 7;
        int val2 = (temp & 8) >>> 3;

        blueX7.algorithmCommon.feedback = val1;

        for (int i = 0; i < blueX7.operators.length; i++) {
            blueX7.operators[i].sync = val2;
        }

        // byte 112 - 115
        blueX7.lfo.speed = sysex[offset++];
        blueX7.lfo.delay = sysex[offset++];
        blueX7.lfo.PMD = sysex[offset++];
        blueX7.lfo.AMD = sysex[offset++];

        // byte 116
        temp = sysex[offset++];
        val1 = temp & 1;
        val2 = (temp & 14) >>> 1;
        int val3 = (temp & 112) >>> 4;

        blueX7.lfo.sync = val1;
        blueX7.lfo.wave = val2;

        for (int i = 0; i < blueX7.operators.length; i++) {
            blueX7.operators[i].modulationPitch = val3;
        }

        // byte 117
        blueX7.algorithmCommon.keyTranspose = sysex[offset++];

    }

    public static final void mapOperatorFromSingle(BlueX7 blueX7, byte[] sysex,
            int operatorNum) {
        Operator op = blueX7.operators[operatorNum];
        int offset = START_OFFSET;
        offset += (5 - operatorNum) * 21; // get us to the operator we want

        // reading envelope generator info - bytes 0 - 7
        op.envelopePoints[0].x = sysex[offset++];
        op.envelopePoints[1].x = sysex[offset++];
        op.envelopePoints[2].x = sysex[offset++];
        op.envelopePoints[3].x = sysex[offset++];
        op.envelopePoints[0].y = sysex[offset++];
        op.envelopePoints[1].y = sysex[offset++];
        op.envelopePoints[2].y = sysex[offset++];
        op.envelopePoints[3].y = sysex[offset++];

        // bytes 8 - 10
        op.breakpoint = sysex[offset++];
        op.depthLeft = sysex[offset++];
        op.depthRight = sysex[offset++];

        // byte 11 - 12
        op.curveLeft = sysex[offset++];
        op.curveRight = sysex[offset++];

        // byte 13 - 15
        op.keyboardRateScaling = sysex[offset++];
        op.modulationAmplitude = sysex[offset++];
        op.velocitySensitivity = sysex[offset++];

        // byte 16
        op.outputLevel = sysex[offset++];

        // byte 17 - 20
        op.mode = sysex[offset++];
        op.freqCoarse = sysex[offset++];
        op.freqFine = sysex[offset++];
        op.detune = sysex[offset++] - 7;

    }

    public static final void mapOperatorFromBank(BlueX7 blueX7, byte[] sysex,
            int patchNum, int operatorNum) {
        Operator op = blueX7.operators[operatorNum];
        int offset = START_OFFSET;
        offset += patchNum * 128;
        offset += (5 - operatorNum) * 17;

        // reading envelope generator info - bytes 0 - 7
        op.envelopePoints[0].x = sysex[offset++];
        op.envelopePoints[1].x = sysex[offset++];
        op.envelopePoints[2].x = sysex[offset++];
        op.envelopePoints[3].x = sysex[offset++];
        op.envelopePoints[0].y = sysex[offset++];
        op.envelopePoints[1].y = sysex[offset++];
        op.envelopePoints[2].y = sysex[offset++];
        op.envelopePoints[3].y = sysex[offset++];

        // bytes 8 - 10
        op.breakpoint = sysex[offset++];
        op.depthLeft = sysex[offset++];
        op.depthRight = sysex[offset++];

        // byte 11
        int temp = sysex[offset++];
        int val1 = temp & 3;
        int val2 = (temp & 12) >>> 2;

        op.curveLeft = val2;
        op.curveRight = val1;

        // byte 12
        temp = sysex[offset++];
        val1 = temp & 7;
        val2 = (temp & 112) >>> 3;

        op.keyboardRateScaling = val1;
        op.detune = val2 - 7;

        // System.out.println("detune: " + op.detune);

        // byte 13
        temp = sysex[offset++];
        val1 = temp & 3;
        val2 = (temp & 56) >>> 2;

        op.modulationAmplitude = val1;
        op.velocitySensitivity = val2;

        // byte 14
        op.outputLevel = sysex[offset++];

        // byte 15
        temp = sysex[offset++];
        val1 = temp & 1;
        val2 = (temp & 62) >>> 1;

        op.mode = val1;
        op.freqCoarse = val2;

        // byte 16
        op.freqFine = sysex[offset++];

    }

    public static final byte[] fileToByteArray(File f) {
        try {
            long len = f.length();
            byte[] bytes = new byte[(int) len];

            FileInputStream fin = new FileInputStream(f);

            // Read in the bytes
            int offset = 0;
            int numRead = 0;
            while (offset < bytes.length
                    && (numRead = fin
                            .read(bytes, offset, bytes.length - offset)) >= 0) {
                offset += numRead;
            }

            // Ensure all the bytes have been read in
            if (offset < bytes.length) {
                throw new IOException("Could not completely read file "
                        + f.getName());
            }

            // Close the input stream and return bytes
            fin.close();

            return bytes;
        } catch (Exception e) {
            return null;
        }
    }

    public static void main(String[] args) {
        File f = new File("/home/steven/dx72csnd/dx72csnd/GUITAR1.DX7");
        byte[] sysex = BlueX7SysexReader.fileToByteArray(f);
        if (sysex == null) {
            System.err.println("[error] could not convert file to byte array");
            return;
        }

        // for(int i = 0; i < sysex.length; i++) {
        // System.out.println(i + ": " + (char)(sysex[i]));
        // }

        System.out.println(BlueX7SysexReader.getSysexType(sysex));
        String[] names = BlueX7SysexReader.getNameListFromBank(sysex);
    }
}
