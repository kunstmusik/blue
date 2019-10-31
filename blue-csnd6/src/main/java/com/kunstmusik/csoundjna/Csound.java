/*
 * Csound.java
 * Copyright (c) 2018 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package com.kunstmusik.csoundjna;

import static com.kunstmusik.csoundjna.CsoundLib.*;
import com.sun.jna.Memory;
import com.sun.jna.Pointer;
import com.sun.jna.ptr.PointerByReference;
import java.nio.ByteBuffer;
import java.nio.DoubleBuffer;

/**
 *
 * @author stevenyi
 */
public class Csound {

    private final Pointer csoundPtr;

    public Csound() {
        csoundPtr = csoundCreate(0);
    }

    public int getVersion() {
        return csoundGetVersion(csoundPtr);
    }

    public int setOption(String option) {
        return csoundSetOption(csoundPtr, option);
    }

    public int evalCode(String s) {
        return csoundEvalCode(csoundPtr, s);
    }

    public int compile(String[] args) {
        return csoundCompile(csoundPtr, args.length, args);
    }

    public int compileOrc(String s) {
        return csoundCompileOrc(csoundPtr, s);
    }

    public int compileOrcAsync(String s) {
        return csoundCompileOrcAsync(csoundPtr, s);
    }

    public int compileCsdText(String csdText) {
        return csoundCompileCsdText(csoundPtr, csdText);
    }

    public double getScoreTime() {
        return csoundGetScoreTime(csoundPtr);
    }

    public int inputMessage(String s) {
        return csoundInputMessage(csoundPtr, s);
    }

    public int inputMessageAsync(String s) {
        return csoundInputMessageAsync(csoundPtr, s);
    }

    public int readScore(String s) {
        return csoundReadScore(csoundPtr, s);
    }

    public int readScoreAsync(String s) {
        return csoundReadScoreAsync(csoundPtr, s);
    }

    public void start() {
        csoundStart(csoundPtr);
    }

    public void stop() {
        csoundStop(csoundPtr);
    }

    public int performKsmps() {
        return csoundPerformKsmps(csoundPtr);
    }

    public int cleanup() {
        return csoundCleanup(csoundPtr);
    }

    public void reset() {
        csoundReset(csoundPtr);
    }

    public void setMessageCallback(MessageCallback cb) {
        csoundSetMessageStringCallback(csoundPtr, cb);
    }

    public int getSr() {
        return csoundGetSr(csoundPtr);
    }

    public int getKr() {
        return csoundGetKr(csoundPtr);
    }

    public int getKsmps() {
        return csoundGetKsmps(csoundPtr);
    }

    public int getNchnls() {
        return csoundGetNchnls(csoundPtr);
    }

    public int getNchnlsInput() {
        return csoundGetNchnlsInput(csoundPtr);
    }

    public double get0dBFS() {
        return csoundGet0dBFS(csoundPtr);
    }

    public DoubleBuffer getSpin() {
        Pointer p = csoundGetSpin(csoundPtr);
        int nchnls_i = csoundGetNchnlsInput(csoundPtr);
        int ksmps = csoundGetKsmps(csoundPtr);
        // 8 since double is 8 bytes in size
        ByteBuffer b = p.getByteBuffer(0, nchnls_i * ksmps * 8);
        return b.asDoubleBuffer();
    }

    public DoubleBuffer getSpout() {
        Pointer p = csoundGetSpout(csoundPtr);
        int nchnls = csoundGetNchnls(csoundPtr);
        int ksmps = csoundGetKsmps(csoundPtr);

        // 8 since double is 8 bytes in size
        ByteBuffer b = p.getByteBuffer(0, nchnls * ksmps * 8);
        return b.asDoubleBuffer();
    }

    public void setChannel(String name, double value) {
        csoundSetControlChannel(csoundPtr, name, value);
    }

    public void setStringChannel(String channelName, String channelValue) {
        csoundSetStringChannel(csoundPtr, channelName, channelValue);
    }

    public Pointer getChannelPtr(String name, int type) {
        PointerByReference pbr = new PointerByReference();
        csoundGetChannelPtr(csoundPtr, pbr, name, type);
        return pbr.getValue();
    }
}
