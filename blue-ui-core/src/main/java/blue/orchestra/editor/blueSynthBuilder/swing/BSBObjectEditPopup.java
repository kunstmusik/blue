/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
import blue.orchestra.blueSynthBuilder.BSBObject;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.ArrayList;
import java.util.List;
import javax.swing.JComponent;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;

/**
 * @author Steven Yi
 */
public class BSBObjectEditPopup extends JPopupMenu implements ActionListener {

    private BSBEditPanel bsbEditPanel = null;

    private BSBObjectViewHolder viewHolder;

    private JMenuItem cut = new JMenuItem("Cut");

    private JMenuItem copy = new JMenuItem("Copy");

    JMenuItem makeGroup = new JMenuItem("Make Group");
    JMenuItem breakGroup = new JMenuItem("Break Group");

    // private JMenuItem paste = new JMenuItem("Paste");
    public BSBObjectEditPopup() {
        JMenuItem remove = new JMenuItem("Remove");

        remove.addActionListener(this);
        cut.addActionListener(this);
        copy.addActionListener(this);

        // make/break groups
        makeGroup.addActionListener(ae -> {
            var selection = bsbEditPanel.getSelection();
            var groupsList = bsbEditPanel.getGroupsList();
            var curGroup = groupsList.get(groupsList.size() - 1);

            // Move original widgets so existing timeline automation Parameters survive.
            List<BSBObject> bsbObjs = new ArrayList<>(selection);
            int x = Integer.MAX_VALUE;
            int y = Integer.MAX_VALUE;

            for (BSBObject bsbObj : bsbObjs) {
                x = Math.min(x, bsbObj.getX());
                y = Math.min(y, bsbObj.getY());
            }

            BSBGroup group = new BSBGroup();
            for (BSBObject bsbObj : bsbObjs) {
                int relativeX = bsbObj.getX() - x + 10;
                int relativeY = bsbObj.getY() - y + 10;
                boolean moved = curGroup.moveBSBObjectTo(bsbObj, group);
                assert moved : "Selected object should belong to the current BSB group";
                if (moved) {
                    bsbObj.setX(relativeX);
                    bsbObj.setY(relativeY);
                }
            }
            selection.clear();

            if (group.size() > 0) {
                group.setX(x);
                group.setY(y);

                curGroup.addBSBObject(group);
            }
        });

        breakGroup.addActionListener(ae -> {
            var selection = bsbEditPanel.getSelection();
            var groupsList = bsbEditPanel.getGroupsList();
            var curGroup = groupsList.get(groupsList.size() - 1);

            BSBGroup group = (BSBGroup) selection.toArray()[0];

            int x = group.getX();
            int y = group.getY();
            List<BSBObject> bsbObjs = new ArrayList<>();

            for (BSBObject bsbObj : group) {
                bsbObjs.add(bsbObj);
            }

            // Move children while the group is still attached, then delete the empty group.
            boolean allMoved = true;
            for (BSBObject bsbObj : bsbObjs) {
                int absoluteX = bsbObj.getX() + x;
                int absoluteY = bsbObj.getY() + y;
                boolean moved = group.moveBSBObjectTo(bsbObj, curGroup);
                assert moved : "Group child should still belong to the selected BSB group";
                if (moved) {
                    bsbObj.setX(absoluteX);
                    bsbObj.setY(absoluteY);
                } else {
                    allMoved = false;
                }
            }

            if (allMoved) {
                curGroup.interfaceItemsProperty().remove(group);
            }
            selection.clear();
            if (allMoved) {
                selection.addAll(bsbObjs);
            }
        });

        // alignment/distribution
        ActionListener alignListener = ae -> {
            var selection = bsbEditPanel.getSelectedViews();
            var compSource = (JComponent) ae.getSource();
            var alignment = (Alignment) compSource.getClientProperty("userData");

            AlignmentUtils.align(selection, alignment);
        };

        ActionListener distributeListener = ae -> {
            var selection = bsbEditPanel.getSelectedViews();
            var compSource = (JComponent) ae.getSource();
            var alignment = (Alignment) compSource.getClientProperty("userData");

            AlignmentUtils.distribute(selection, alignment);
        };

        JMenu alignMenu = new JMenu("Align");
        JMenu distributeMenu = new JMenu("Distribute");

        for (Alignment alignment : Alignment.values()) {

            JMenuItem a = new JMenuItem(alignment.toString());
            a.putClientProperty("userData", alignment);
            a.addActionListener(alignListener);

            JMenuItem d = new JMenuItem(alignment.toString());
            d.putClientProperty("userData", alignment);
            d.addActionListener(distributeListener);

            alignMenu.add(a);
            distributeMenu.add(d);
        }

        // setup menu
        this.add(cut);
        this.add(copy);
        this.add(remove);
        this.addSeparator();
        this.add(makeGroup);
        this.add(breakGroup);
        this.addSeparator();
        this.add(alignMenu);
        this.add(distributeMenu);

        this.addPopupMenuListener(new PopupMenuListener() {
            @Override
            public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                var selection = bsbEditPanel.getSelection();

                breakGroup.setEnabled(selection.size() == 1 
                        && (selection.toArray()[0] instanceof BSBGroup));
            }

            @Override
            public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
            }

            @Override
            public void popupMenuCanceled(PopupMenuEvent e) {
            }
        });
    }

    public void setBSBEditPanel(BSBEditPanel bsbEditPanel) {
        this.bsbEditPanel = bsbEditPanel;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        switch (e.getActionCommand()) {
            case "Cut":
                if (bsbEditPanel != null) {
                    bsbEditPanel.cut();
                }
                break;
            case "Copy":
                if (bsbEditPanel != null) {
                    bsbEditPanel.copy();
                }
                break;
            case "Remove":
                if (bsbEditPanel != null) {
                    bsbEditPanel.removeSelectedBSBObjects();
                }
                break;
        }
    }

    public void show(BSBObjectViewHolder viewHolder, int x, int y) {
        this.viewHolder = viewHolder;

        super.show(viewHolder, x, y);
    }
}
