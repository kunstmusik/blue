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
package blue;

import blue.orchestra.Instrument;
import java.util.HashMap;

//TODO - Should probably add methods to this class so that Arrangement, 
//OpcodeList, etc. are hidden from public and to reduce dependencies

/**
 * Data class used when rendering a CSD that holds data classes (OpcodeList, 
 * Arrangement, tables, global orc/sco, generic map for transient data)
 * 
 * @author stevenyi
 */
public class CompileData {
    
    private final HashMap compileMap = new HashMap();
    private final Arrangement arrangement;
    private final Tables tables;

    public static CompileData createEmptyCompileData() {
        CompileData compileData = new CompileData(
                new Arrangement(), new Tables());
        return compileData;
    }
    
    public CompileData(Arrangement arrangement, Tables tables) {
        this.arrangement = arrangement;
        this.tables = tables;
    }

    /** 
     * Adds and instrument to the Arrangement 
     * @return instrument id that was assigned
     */
    
    public int addInstrument(Instrument instrument) {
        return arrangement.addInstrument(instrument);
    }

/**
     * Gets compilation variable; should only be called by plugins when
     * compiling a CSD is happening. Plugins can check variables that are set,
     * useful for caching ID's, instruments, etc.
     */
    public Object getCompilationVariable(Object key) {
        if(!compileMap.containsKey(key)) {
            return null;
        }
        return compileMap.get(key);
    }

    /**
     * Sets compilation variable; should only be called by plugins when
     * compiling a CSD is happening. Plugins can set variables, useful for
     * caching ID's, instruments, etc.
     */
    public void setCompilationVariable(Object key, Object value) {
        compileMap.put(key, value);
    }

    public int getOpenFTableNumber() {
        return tables.getOpenFTableNumber();
    }

    public void appendTables(String tablesString) {
        tables.setTables(tables.getTables() + "\n" + tablesString);
    }
   
}
