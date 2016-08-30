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

import blue.gui.FileTree;
import blue.gui.FileTreeListener;
import blue.gui.FileTreePopup;
import blue.utility.GUI;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.datatransfer.Clipboard;
import java.awt.datatransfer.StringSelection;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import javax.swing.JComponent;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTabbedPane;
import javax.swing.JTable;

/**
 * @author Steven Yi
 */
public class SoundFontViewer extends JComponent {

    JTable instrumentInfo = new JTable(new InstrumentInfoTableModel());

    JTable presetInfo = new JTable(new PresetInfoTableModel());

    public SoundFontViewer() {
        this.setLayout(new BorderLayout());
        JSplitPane split = new JSplitPane();
        this.add(split, BorderLayout.CENTER);

        FileTree fTree = new FileTree();

        fTree.setMinimumSize(new Dimension(0, 0));

        String[] filters = { ".sf2" };

        fTree.setFilters(filters);

        fTree.addFileTreeListener(this::getSoundFontInfo);
        
        fTree.addFileTreePopup(new SFFileTreePopup());

        JTabbedPane tabs = new JTabbedPane();

        JScrollPane scrollInstrument = new JScrollPane();
        scrollInstrument.setBorder(null);
        scrollInstrument.setViewportView(instrumentInfo);

        JScrollPane scrollPreset = new JScrollPane();
        scrollPreset.setBorder(null);
        scrollPreset.setViewportView(presetInfo);

        tabs.add("Instruments", scrollInstrument);
        tabs.add("Presets", scrollPreset);

        split.add(fTree, JSplitPane.LEFT);
        split.add(tabs, JSplitPane.RIGHT);

        split.setDividerLocation(200);
    }

    protected void getSoundFontInfo(File f) {
        // TODO Auto-generated method stub
        SoundFontInfo info = SoundFontUtility.getSoundFontInfo(f
                .getAbsolutePath());

        instrumentInfo.setModel(info.instrumentTableModel);
        presetInfo.setModel(info.presetTableModel);
    }

    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();

        GUI.showComponentAsStandalone(new SoundFontViewer(),
                "Sound Font Viewer", true);
    }

    
    private class SFFileTreePopup extends JPopupMenu implements FileTreePopup {

        private File file;

        public SFFileTreePopup() {
            JMenuItem menuItem = new JMenuItem("Copy Path");
            menuItem.addActionListener((ActionEvent arg0) -> {
                if(file != null && file.exists() && file.isFile()) {
                    Clipboard clipboard = getToolkit().getSystemClipboard();
                    clipboard.setContents(new StringSelection(file.getAbsolutePath()), null);
                }
            });
            
            this.add(menuItem);
        }
        
        @Override
        public void show(File f, Component c, int x, int y) {
            this.file = f;
            this.show(c, x, y);
        }

        
        
    }
}
