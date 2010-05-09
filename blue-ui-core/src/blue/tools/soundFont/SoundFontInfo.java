/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.tools.soundFont;

import java.util.StringTokenizer;

/**
 * @author steven
 * 
 */
public class SoundFontInfo {

    public String instrumentList;

    public String presetList;

    public InstrumentInfoTableModel instrumentTableModel = new InstrumentInfoTableModel();

    public PresetInfoTableModel presetTableModel = new PresetInfoTableModel();

    public SoundFontInfo(String instrumentList, String presetList) {
        this.instrumentList = instrumentList;
        this.presetList = presetList;

        setupInstruments();
        setupPresets();
    }

    private void setupPresets() {
        StringTokenizer st = new StringTokenizer(presetList, "\n");
        while (st.hasMoreTokens()) {
            String line = st.nextToken();

            int index = line.indexOf(")");
            int index2 = line.indexOf("prog");

            String[] parts = line.split("\\s+");

            PresetInfo pInfo = new PresetInfo();

            pInfo.num = line.substring(0, index).trim();
            pInfo.name = line.substring(index + 1, index2).trim();
            pInfo.bank = parts[parts.length - 1].substring(5);
            pInfo.presetNum = parts[parts.length - 2].substring(5);

            presetTableModel.addPresetInfo(pInfo);
        }
    }

    private void setupInstruments() {
        StringTokenizer st = new StringTokenizer(instrumentList, "\n");
        while (st.hasMoreTokens()) {
            String line = st.nextToken();

            int index = line.indexOf(")");

            InstrumentInfo instrInfo = new InstrumentInfo();

            instrInfo.num = line.substring(0, index).trim();
            instrInfo.name = line.substring(index + 1).trim();

            instrumentTableModel.addInfo(instrInfo);
        }
    }

}