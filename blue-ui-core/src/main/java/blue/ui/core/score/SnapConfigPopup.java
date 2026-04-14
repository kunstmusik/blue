/*
 * blue - object composition environment for csound
 * Copyright (c) 2025 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score;

import blue.score.SnapValue;
import blue.score.SnapValue.SnapCategory;
import java.util.function.Consumer;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;

/**
 * Popup menu for selecting snap values.
 * Organizes snap values by category (Musical, Triplets, Time, SMPTE, Samples, Auto).
 *
 * @author Steven Yi
 */
public class SnapConfigPopup extends JPopupMenu {

    private final Consumer<SnapValue> onSnapValueSelected;

    public SnapConfigPopup(Consumer<SnapValue> onSnapValueSelected) {
        this.onSnapValueSelected = onSnapValueSelected;
        buildMenu();
    }
    
    private void buildMenu() {
        // Musical values submenu
        JMenu musicalMenu = new JMenu("Musical");
        for (SnapValue sv : SnapValue.values()) {
            if (sv.getCategory() == SnapCategory.MUSICAL) {
                JMenuItem item = new JMenuItem(sv.getDisplayName());
                item.addActionListener(e -> onSnapValueSelected.accept(sv));
                musicalMenu.add(item);
            }
        }
        add(musicalMenu);
        
        // Triplets submenu
        JMenu tripletsMenu = new JMenu("Triplets");
        for (SnapValue sv : SnapValue.values()) {
            if (sv.getCategory() == SnapCategory.TRIPLET) {
                JMenuItem item = new JMenuItem(sv.getDisplayName());
                item.addActionListener(e -> onSnapValueSelected.accept(sv));
                tripletsMenu.add(item);
            }
        }
        add(tripletsMenu);
        
        addSeparator();
        
        // Time-based submenu
        JMenu timeMenu = new JMenu("Time");
        for (SnapValue sv : SnapValue.values()) {
            if (sv.getCategory() == SnapCategory.TIME) {
                JMenuItem item = new JMenuItem(sv.getDisplayName());
                item.addActionListener(e -> onSnapValueSelected.accept(sv));
                timeMenu.add(item);
            }
        }
        add(timeMenu);
        
        // SMPTE submenu
        JMenu smpteMenu = new JMenu("SMPTE");
        for (SnapValue sv : SnapValue.values()) {
            if (sv.getCategory() == SnapCategory.SMPTE) {
                JMenuItem item = new JMenuItem(sv.getDisplayName());
                item.addActionListener(e -> onSnapValueSelected.accept(sv));
                smpteMenu.add(item);
            }
        }
        add(smpteMenu);
        
        // Samples
        for (SnapValue sv : SnapValue.values()) {
            if (sv.getCategory() == SnapCategory.SAMPLE) {
                JMenuItem item = new JMenuItem(sv.getDisplayName());
                item.addActionListener(e -> onSnapValueSelected.accept(sv));
                add(item);
            }
        }
        
        addSeparator();
        
        // Auto mode
        JMenuItem autoItem = new JMenuItem(SnapValue.AUTO.getDisplayName());
        autoItem.addActionListener(e -> onSnapValueSelected.accept(SnapValue.AUTO));
        add(autoItem);
    }
}
