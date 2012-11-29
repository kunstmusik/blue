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

import java.util.ArrayList;
import java.util.Set;

/**
 *
 * @author stevenyi
 */
public class OpcodeDocCategory {
    public String categoryName = "";
    public ArrayList<OpcodeDocCategory> subGroups = new ArrayList<OpcodeDocCategory>();
    public ArrayList<OpcodeDoc> opcodes = new ArrayList<OpcodeDoc>();
    
    public String toString() {
        StringBuilder str = new StringBuilder();
        toString("", str);
        return str.toString();
    }
    
    public void toString(String indent, StringBuilder str) {
        
        String indent1 = indent;
        String indent2 = indent1 + "  ";
        
        str.append(indent1).append("Category: ").append(this.categoryName).append(
                "\n");
        for(OpcodeDocCategory cat : subGroups) {
            cat.toString(indent2, str);
        }
        for(OpcodeDoc op : opcodes) {
            op.toString(indent2, str);
        }
    }
    
    public void appendOpcodes(Set<String> opNames) {
        for(OpcodeDocCategory cat : subGroups) {
            cat.appendOpcodes(opNames);
        }
        for(OpcodeDoc op : opcodes) {
            opNames.add(op.opcodeName);
        }
    }
}
