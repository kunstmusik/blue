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

import blue.automation.Automatable;
import blue.automation.Parameter;
import blue.automation.ParameterList;
import blue.automation.ParameterNameManager;
import blue.mixer.Channel;
import blue.orchestra.Instrument;
import blue.orchestra.blueSynthBuilder.StringChannel;
import blue.orchestra.blueSynthBuilder.StringChannelNameManager;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

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
    private final Map<Channel, Integer> channelIdAssignments;
    private final Map<Instrument, String> instrSourceId;
    private boolean handleParametersAndChannels = true;
    private StringBuilder globalOrc;
    

    public static CompileData createEmptyCompileData() {
        CompileData compileData = new CompileData(
                new Arrangement(), new Tables());
        return compileData;
    }
    
    private ArrayList<StringChannel> stringChannels = null;
    private ArrayList originalParameters = null;
    private StringChannelNameManager scnm = null;
    private ParameterNameManager pnm;

    
    public CompileData(Arrangement arrangement, Tables tables) {
        this.arrangement = arrangement;
        this.tables = tables;
        channelIdAssignments = new HashMap<>();
        instrSourceId = new HashMap<>();
        globalOrc = new StringBuilder();
        setHandleParametersAndChannels(false);
    }

    public CompileData(Arrangement arrangement, Tables tables, 
            ArrayList<StringChannel> stringChannels, 
            ArrayList originalParameters, StringChannelNameManager scnm,
            ParameterNameManager pnm) {
        this.arrangement = arrangement;
        this.tables = tables;
        this.stringChannels = stringChannels;
        this.originalParameters = originalParameters;
        this.scnm = scnm;
        this.pnm = pnm;
        
        channelIdAssignments = new HashMap<>();
        instrSourceId = new HashMap<>();
        globalOrc = new StringBuilder();
        setHandleParametersAndChannels(true);
    }

    public void setHandleParametersAndChannels(boolean handleParametersAndChannels) {
        this.handleParametersAndChannels = handleParametersAndChannels;
    }

    
    
    /** 
     * Adds and instrument to the Arrangement 
     * @return instrument id that was assigned
     */
    
    public int addInstrument(Instrument instrument) {
        if(handleParametersAndChannels && stringChannels != null && originalParameters != null) {
            if(instrument instanceof Automatable) {
                Automatable auto = (Automatable) instrument;
                ArrayList<StringChannel> tempStringChannels = auto.getStringChannels();
                if(tempStringChannels != null) {
                    stringChannels.addAll(tempStringChannels);
                    
                    for(StringChannel sChan : tempStringChannels) {
                        sChan.setChannelName(scnm.getUniqueStringChannel());
                    }
                }
                ParameterList paramList = auto.getParameterList();
                if(paramList != null) {
                    originalParameters.addAll(paramList.getParameters());
                    for(Parameter param : paramList.getParameters()) {
                        param.setCompilationVarName(pnm.getUniqueParamName());
                    }
                }
            }
        }
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
  
    public Map<Channel, Integer> getChannelIdAssignments() {
        return channelIdAssignments;
    }

    /** Used to associate a source arrangmentId with an instr.  The instr should
     * be one that is generated for always-on instr text. arrangementId is the 
     * arrangementId of the original instr, and used to replace <INSTR_ID>.
     * 
     * @param instr
     * @param sourceId 
     */
    public void addInstrSourceId(Instrument instr, String sourceId) {
        instrSourceId.put(instr, sourceId);
    }

    public String getInstrSourceId(Instrument instr) {
        return instrSourceId.get(instr);
    }
    
    public void appendGlobalOrc(String orcText) {
        if(orcText != null) {
            globalOrc.append(orcText).append("\n");
        }
    }
    
    public String getGlobalOrc() {
        return globalOrc.toString();
    }
}
