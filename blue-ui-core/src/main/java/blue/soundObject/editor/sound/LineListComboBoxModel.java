/*
 * blue - object composition environment for csound
 * Copyright (C) 2020 stevenyi
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
package blue.soundObject.editor.sound;

import blue.components.lines.Line;
import blue.components.lines.LineList;
import java.util.ArrayList;
import java.util.List;
import javax.swing.ComboBoxModel;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;

/**
 *
 * @author Steven Yi
 */
public class LineListComboBoxModel implements ComboBoxModel<Line> {

    int selectedIndex = 0;
    private LineList lineList = null;

    List<ListDataListener> listeners;

    public LineListComboBoxModel() {
        listeners = new ArrayList<>();
    }

    public void setLineList(LineList lineList) {
        this.lineList = lineList;

        ListDataEvent lde = new ListDataEvent(this, ListDataEvent.CONTENTS_CHANGED, 0, lineList.size());
        for(var l : listeners) {
            l.contentsChanged(lde);
        }
    }

    @Override
    public void setSelectedItem(Object anItem) {
        selectedIndex = (lineList == null) ? -1 : lineList.indexOf(anItem);
    }

    @Override
    public Object getSelectedItem() {
        if(lineList == null) return null;
        if (selectedIndex >= 0 && selectedIndex < lineList.getSize()) {
            return lineList.get(selectedIndex);
        }
        return null;
    }

    @Override
    public int getSize() {
        return (lineList == null) ? 0 : lineList.size();
    }

    @Override
    public Line getElementAt(int index) {
        if(lineList == null) return null;
        
        if (index >= 0 && index < lineList.size()) {
            return lineList.get(index);
        }
        return null;
    }

    @Override
    public void addListDataListener(ListDataListener l) {
        listeners.add(l);
    }

    @Override
    public void removeListDataListener(ListDataListener l) {
        listeners.remove(l);
    }

}
