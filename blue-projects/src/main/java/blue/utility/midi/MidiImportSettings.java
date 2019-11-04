/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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
package blue.utility.midi;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import javax.swing.table.AbstractTableModel;

public class MidiImportSettings extends AbstractTableModel {

    List<TrackImportSettings> settings = Collections.synchronizedList(new ArrayList<>());

    public void addTrackImportSetting(TrackImportSettings trSetting) {
        settings.add(trSetting);
    }

    public TrackImportSettings getTrackSettingsForTrackNum(int trackNum) {
        for (TrackImportSettings trSettings : settings) {
            if (trSettings.getTrackNumber() == trackNum) {
                return trSettings;
            }
        }
        return null;
    }

    @Override
    public Class<?> getColumnClass(int columnIndex) {
        switch (columnIndex) {
            case 0:
            case 1:
            case 2:
                return String.class;
            case 3:
                return Boolean.class;
        }
        return null;
    }

    public List<TrackImportSettings> getSettings() {
        return settings;
    }

    @Override
    public int getColumnCount() {
        return 4;
    }

    @Override
    public String getColumnName(int columnIndex) {
        switch (columnIndex) {
            case 0:
                return "Track";
            case 1:
                return "Instrument ID";
            case 2:
                return "Note Template";
            case 3:
                return "Trim Time";
        }

        return null;
    }

    @Override
    public int getRowCount() {
        return settings.size();
    }

    @Override
    public void setValueAt(Object aValue, int rowIndex, int columnIndex) {

        TrackImportSettings trSetting = settings.get(rowIndex);

        switch (columnIndex) {
            case 1:
                trSetting.setInstrId(((String) aValue).trim());
                break;
            case 2:
                trSetting.setNoteTemplate(((String) aValue).trim());
                break;
            case 3:
                trSetting.setTrim(((Boolean) aValue).booleanValue());
        }

    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        TrackImportSettings trSetting = settings.get(rowIndex);

        switch (columnIndex) {
            case 0:
                return Integer.toString(trSetting.getTrackNumber());
            case 1:
                return trSetting.getInstrId();
            case 2:
                return trSetting.getNoteTemplate();
            case 3:
                return Boolean.valueOf(trSetting.isTrim());
        }

        return null;
    }

    @Override
    public boolean isCellEditable(int rowIndex, int columnIndex) {
        return columnIndex != 0;
    }

}
