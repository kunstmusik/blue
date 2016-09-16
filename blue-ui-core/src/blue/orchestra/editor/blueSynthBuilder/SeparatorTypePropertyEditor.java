/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

package blue.orchestra.editor.blueSynthBuilder;

import blue.orchestra.blueSynthBuilder.BSBLineObject;
import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyEditorSupport;
import javax.swing.JComboBox;

public class SeparatorTypePropertyEditor extends PropertyEditorSupport {

    private JComboBox<BSBLineObject.SeparatorType> options;
    private String[] tags;

    public SeparatorTypePropertyEditor() {
        super();
        BSBLineObject.SeparatorType[] sepTypes = 
                BSBLineObject.SeparatorType.values();
        options = new JComboBox<>();
        options.addActionListener((ActionEvent e) -> {
            setValueFromComboBox();
        });

        tags = new String[sepTypes.length];
        for(int i = 0; i < sepTypes.length; i++) {
           tags[i] = sepTypes[i].toString();
        }
    }

    private void setValueFromComboBox() {
        super.setValue(options.getSelectedItem());
    }

    @Override
    public void setValue(Object value) {
        super.setValue(value);
        options.setSelectedItem(value);
    }

    @Override
    public String[] getTags() {
        return tags;
    }

    @Override
    public Component getCustomEditor() {
        return options;
    }

    @Override
    public boolean supportsCustomEditor() {
        return true;
    }

}
