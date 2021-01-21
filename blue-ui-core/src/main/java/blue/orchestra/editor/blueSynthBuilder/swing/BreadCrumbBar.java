/*
 * blue - object composition environment for csound
 * Copyright (c) 2021 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.orchestra.blueSynthBuilder.BSBGroup;
import java.awt.Color;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import jiconfont.icons.font_awesome.FontAwesome;
import jiconfont.swing.IconFontSwing;

/**
 *
 * @author syyigmmbp
 */
public class BreadCrumbBar extends JPanel {

    private final ObservableList<BSBGroup> items;

    ListChangeListener<? super BSBGroup> lcl;

    MouseAdapter ml;

    public BreadCrumbBar(ObservableList<BSBGroup> items) {
        this.items = items;
        this.setLayout(new FlowLayout(FlowLayout.LEFT));
        updateItems();

        lcl = (change) -> {
            updateItems();
        };

        
        Color normalBG = new JLabel().getBackground();
        Color overBG = normalBG.brighter();

        ml = new MouseAdapter() {

            @Override
            public void mouseExited(MouseEvent e) {
                e.getComponent().setBackground(normalBG);
            }

            @Override
            public void mouseEntered(MouseEvent e) {
                e.getComponent().setBackground(overBG);
            }

            @Override
            public void mousePressed(MouseEvent e) {
                JComponent jc = (JComponent) e.getComponent();
                var group = (BSBGroup) jc.getClientProperty("group");
                if (group != items.get(items.size() - 1)) {
                    items.remove(items.indexOf(group) + 1, items.size());
                }
            }

        };
    }

    @Override
    public void addNotify() {
        super.addNotify();

        items.addListener(lcl);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        items.removeListener(lcl);
    }

    private void updateItems() {
        removeAll();

        if (items.size() == 0) {
            return;
        }

        var first = items.get(0);
        var last = items.get(items.size() - 1);
        
        for (var item : items) {
            if (item != first) {
                add(new JLabel(IconFontSwing.buildIcon(FontAwesome.CHEVRON_RIGHT, 10, Color.WHITE)));
            }
            var label = new JLabel(item == first ? "Root" : item.getGroupName());
            label.putClientProperty("group", item);
            label.setOpaque(true);
            
            if(item != last) {
                label.addMouseListener(ml);
                label.addMouseMotionListener(ml);
            }
            
            add(label);
        }
        revalidate();
        repaint();
    }
}
