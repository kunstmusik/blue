/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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

package blue;

import blue.orchestra.Instrument;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.FlowLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.ComponentEvent;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.util.TreeMap;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.ListSelectionModel;
import javax.swing.border.Border;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public final class InstrumentLibraryImportDialog extends JDialog {
    Instrument focusedInstrument;

    Integer currentInstrumentNumber;

    TreeMap orchTree = new TreeMap();

    BorderLayout borderLayout1 = new BorderLayout();

    JPanel buttonPanel = new JPanel();

    JTable orchestraTable;

    JScrollPane orchScrollPane = new JScrollPane();

    BlueData data;

    Border border1;

    JButton copyButton = new JButton();

    FlowLayout flowLayout1 = new FlowLayout();

    // JButton saveButton = new JButton();

    public InstrumentLibraryImportDialog(JFrame owner, BlueData data) {
        super(owner);

        this.data = data;
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        border1 = BorderFactory.createLineBorder(Color.white, 1);
        this.setTitle(BlueSystem.getString("instrument.instrumentLibrary"));
        this.addComponentListener(new java.awt.event.ComponentAdapter() {
            @Override
            public void componentHidden(ComponentEvent e) {
                dispose();
            }
        });

        OrchestraTableModel orchTableModel = new OrchestraTableModel();
        orchestraTable = new JTable(orchTableModel);
        // orchTableModel.setOrchestra(data.getOrchestra());
        // this.orchTree = data.getOrchestra().getOrchestra();

        this.getContentPane().setLayout(borderLayout1);

        orchestraTable.addKeyListener(new KeyAdapter() {
            @Override
            public void keyReleased(KeyEvent e) {
                if (e.getKeyCode() == 127) {
                    removeInstrument();
                }
            }
        });
        buttonPanel.setBorder(border1);
        buttonPanel.setLayout(flowLayout1);
        copyButton.setText(BlueSystem.getString("instrument.copyToLibrary"));
        copyButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                copyInstrument();
            }
        });

        flowLayout1.setAlignment(FlowLayout.CENTER);
        this.getContentPane().add(buttonPanel, BorderLayout.NORTH);
        buttonPanel.add(copyButton, null);

        this.getContentPane().add(orchScrollPane, BorderLayout.CENTER);
        orchScrollPane.getViewport().add(orchestraTable);

        orchestraTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        orchestraTable.getTableHeader().getColumnModel().getColumn(0)
                .setPreferredWidth(50);
        orchestraTable.getTableHeader().getColumnModel().getColumn(0)
                .setMaxWidth(50);
        orchestraTable.getTableHeader().getColumnModel().getColumn(0)
                .setMinWidth(50);
        orchestraTable.getTableHeader().setReorderingAllowed(false);
        orchestraTable.getSelectionModel().addListSelectionListener(
                new ListSelectionListener() {
                    @Override
                    public void valueChanged(ListSelectionEvent e) {
                        if (e.getValueIsAdjusting()) {
                            return;
                        } else {
                            int index = orchestraTable.getSelectedRow();
                            if (index != -1) {
                                currentInstrumentNumber = (Integer) orchestraTable
                                        .getValueAt(index, 1);
                                focusedInstrument = (Instrument) (orchTree
                                        .get(currentInstrumentNumber));
                            }
                        }
                    }
                });
    }

    public void copyInstrument() {
        /*
         * if (focusedInstrument != null) { Instrument temp = (Instrument)
         * focusedInstrument.clone();
         * main.getOrchestraGUI().addInstrument(temp); }
         */
    }

    private void removeInstrument() {
        if (focusedInstrument != null) {
            orchestraTable.clearSelection();
            data.getOrchestra().removeInstrument(currentInstrumentNumber);
            focusedInstrument = null;
            currentInstrumentNumber = null;
            orchestraTable.repaint();
        }
    }

}