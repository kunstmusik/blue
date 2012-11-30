/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package csound.manual;

import csound.manual.impl.OpcodesParser;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 *
 * @author stevenyi
 */
public class CsoundManualUtilities {

    private static OpcodeDocCategory cat;
    private static Map<String,String> opcodesMap = new HashMap<String, String>();


    static {
        cat = OpcodesParser.loadOpcodesXML();
        cat.appendOpcodes(opcodesMap);
    }

    public static OpcodeDocCategory getOpcodeDocCategory() {
        return cat;
    }

    public static Set<String> getOpcodeNames() {
        return opcodesMap.keySet();
    }

    public static String getOpcodeSignature(String opcodeName) {
        return opcodesMap.get(opcodeName);
    }
}
