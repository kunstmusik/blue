/*
 * CsoundLib.java
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

import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Platform;
import com.sun.jna.Pointer;
import com.sun.jna.ptr.PointerByReference;

/**
 * Wrapper class using JNA's DirectMapping system:
 *
 * https://github.com/java-native-access/jna/blob/master/www/DirectMapping.md
 *
 * @author stevenyi
 */
public class CsoundLib {
    
    interface CsoundInterfaceLib extends Library {
        int csoundCompile(Pointer p, int argc, String[] argv);
    }

    public static final int CSOUNDINIT_NO_SIGNAL_HANDLER = 1;
    public static final int CSOUNDINIT_NO_ATEXIT = 2;
    
    private static CsoundInterfaceLib interfaceLib;

    static {
        String libname = (Platform.getOSType() == Platform.MAC) ? "CsoundLib64" : "csound64";
        Native.register(libname);
        
        interfaceLib = Native.load(libname, CsoundInterfaceLib.class);

        // This pretty much needs to always happen when in a JVM app
        csoundInitialize(CSOUNDINIT_NO_ATEXIT | CSOUNDINIT_NO_SIGNAL_HANDLER);
    }

    public static native Pointer csoundCreate(long l);

    public static native int csoundGetVersion(Pointer p);

    public static native int csoundInitialize(int flags);

    public static native int csoundSetOption(Pointer p, String option);

    public static native int csoundEvalCode(Pointer p, String str);
    
    public static int csoundCompile(Pointer p, int argc, String[] argv) {
        return interfaceLib.csoundCompile(p, argc, argv);
    }

    public static native int csoundCompileOrc(Pointer p, String str);

    public static native int csoundCompileOrcAsync(Pointer p, String str);

    public static native int csoundCompileCsdText(Pointer p, String csd_text);

    public static native double csoundGetScoreTime(Pointer p);
    
    public static native int csoundGetChannelPtr(Pointer csound, PointerByReference p, String name, int type);
    
    public static native int csoundInputMessage(Pointer p, String str);

    public static native int csoundInputMessageAsync(Pointer p, String str);

    public static native int csoundReadScore(Pointer p, String str);

    public static native int csoundReadScoreAsync(Pointer p, String str);

    public static native int csoundPerformKsmps(Pointer p);

    public static native int csoundStart(Pointer p);

    public static native void csoundStop(Pointer p);

    public static native int csoundCleanup(Pointer p);

    public static native void csoundReset(Pointer p);

    public static native void csoundSetMessageStringCallback(Pointer p,
            MessageCallback cb);

    public static native int csoundGetSr(Pointer p);

    public static native int csoundGetKr(Pointer p);

    public static native int csoundGetKsmps(Pointer p);

    public static native int csoundGetNchnls(Pointer p);

    public static native int csoundGetNchnlsInput(Pointer p);

    public static native double csoundGet0dBFS(Pointer p);

    public static native Pointer csoundGetSpin(Pointer p);

    public static native Pointer csoundGetSpout(Pointer p);

    public static native void csoundSetControlChannel(Pointer p, String channelName, double value);
    
    public static native void csoundSetStringChannel(Pointer p, String channelName, String value);
}
