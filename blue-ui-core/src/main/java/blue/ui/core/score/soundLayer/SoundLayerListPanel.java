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

package blue.ui.core.score.soundLayer;

import blue.SoundLayer;
import blue.noteProcessor.NoteProcessorChainMap;
import blue.soundObject.PolyObject;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;

/**
 * 
 * @author steven
 */
public class SoundLayerListPanel extends javax.swing.JPanel {

    private PolyObject pObj;

    LayersPanel layers = new LayersPanel();

    LayerHeightPopup heightPopup = null;

    /** Creates new form SoundLayerListPanel2 */
    public SoundLayerListPanel() {
        initComponents();

        this.add(layers, BorderLayout.CENTER);
    }

    public void setPolyObject(PolyObject pObj) {
        this.pObj = pObj;

        layers.setPolyObject(pObj);
    }

    public void setNoteProcessorChainMap(NoteProcessorChainMap npcMap) {
        layers.setNoteProcessorChainMap(npcMap);
    }
    /**
     * This method is called from within the constructor to initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is always
     * regenerated by the Form Editor.
     */
    // <editor-fold defaultstate="collapsed" desc=" Generated Code
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        setLayout(new java.awt.BorderLayout());
    }// </editor-fold>//GEN-END:initComponents

    // Variables declaration - do not modify//GEN-BEGIN:variables
    // End of variables declaration//GEN-END:variables

    private class LayerHeightPopup extends JPopupMenu {

        JMenuItem[] heightItems = new JMenuItem[9];

        public LayerHeightPopup() {
            super();

            ActionListener allListener = (ActionEvent ae) -> {
                if (pObj == null) {
                    return;
                }
                
                int heightIndex = Integer.parseInt(ae.getActionCommand()) - 1;
                
                for (int i = 0; i < pObj.size(); i++) {
                    SoundLayer temp = pObj.get(i);
                    temp.setHeightIndex(heightIndex);
                }
            };

            ActionListener defaultListener = (ActionEvent ae) -> {
                if (pObj == null) {
                    return;
                }
                
                int heightIndex = Integer.parseInt(ae.getActionCommand()) - 1;
                
                pObj.setDefaultHeightIndex(heightIndex);
            };

            JMenu setAllMenu = new JMenu("Set All Layer Heights");

            for (int i = 0; i < heightItems.length; i++) {
                JMenuItem item = new JMenuItem(Integer.toString(i + 1));
                item.addActionListener(allListener);

                setAllMenu.add(item);
            }

            JMenu setDefaultMenu = new JMenu("Set Default Layer Height");

            for (int i = 0; i < heightItems.length; i++) {
                heightItems[i] = new JMenuItem(Integer.toString(i + 1));
                heightItems[i].addActionListener(defaultListener);

                setDefaultMenu.add(heightItems[i]);
            }

            this.add(setAllMenu);
            this.add(setDefaultMenu);

            this.addPopupMenuListener(new PopupMenuListener() {
                @Override
                public void popupMenuCanceled(PopupMenuEvent e) {
                }

                @Override
                public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
                }

                @Override
                public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                    if (pObj == null) {
                        return;
                    }

                    int defaultHeightIndex = pObj.getDefaultHeightIndex();

                    for (int i = 0; i < heightItems.length; i++) {
                        heightItems[i].setEnabled(i != defaultHeightIndex);
                    }
                }
            });
        }
    }
}