/*
 * blue - object composition environment for csound Copyright (c) 2001-2008
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.render;

import blue.automation.Parameter;
import blue.noteProcessor.TempoMapper;
import blue.orchestra.blueSynthBuilder.StringChannel;
import java.util.ArrayList;

/**
 *
 * @author syi
 */
public class CsdRenderResult {

    private String csdText;
    private TempoMapper tempoMapper;
    private ArrayList<Parameter> parameters;
    private ArrayList<StringChannel> stringChannels;

    public CsdRenderResult(String csdText, TempoMapper tempoMapper, 
            ArrayList<Parameter> parameters, 
            ArrayList<StringChannel> stringChannels) {
        this.csdText = csdText;
        this.tempoMapper = tempoMapper;
        this.parameters = parameters;
        this.stringChannels = stringChannels;
    }

    public String getCsdText() {
        return csdText;
    }

    public ArrayList<Parameter> getParameters() {
        return parameters;
    }

    public ArrayList<StringChannel> getStringChannels() {
        return stringChannels;
    }
   
    public TempoMapper getTempoMapper() {
        return tempoMapper;
    }
}
