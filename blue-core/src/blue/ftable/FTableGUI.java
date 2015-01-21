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

package blue.ftable;

import blue.BlueData;
import blue.ftable.genRoutine.GenericTableEdittor;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.event.*;
import javax.swing.*;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class FTableGUI extends JComponent {
    JSplitPane sp = new JSplitPane();

    GenericTableEdittor tabEdittor = new GenericTableEdittor();

    JPanel topPanel = new JPanel();

    JScrollPane ftableScrollPane = new JScrollPane();

    JTable ftableTable = new JTable();

    JPanel buttonPanel = new JPanel();

    JButton addFTableButton = new JButton();

    JButton removeFTableButton = new JButton();

    BlueData data;

    FTable focusedFTable;

    FTableSet ftables = new FTableSet();

    public FTableGUI() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setLayout(new BorderLayout());
        sp.setOrientation(JSplitPane.VERTICAL_SPLIT);
        sp.setLastDividerLocation(200);
        topPanel.setLayout(new BorderLayout());
        addFTableButton.setText("add FTable");
        removeFTableButton.setText("remove FTable");
        // ftEdittor.setLayout(new BorderLayout());
        this.add(sp, BorderLayout.CENTER);
        sp.add(tabEdittor, JSplitPane.BOTTOM);
        sp.add(topPanel, JSplitPane.TOP);
        topPanel.add(ftableScrollPane, BorderLayout.CENTER);
        topPanel.add(buttonPanel, BorderLayout.NORTH);
        buttonPanel.setLayout(new FlowLayout(FlowLayout.LEFT));
        buttonPanel.add(addFTableButton, null);
        buttonPanel.add(removeFTableButton, null);
        ftableScrollPane.getViewport().add(ftableTable, null);
        sp.setDividerLocation(200);

        ftableTable.setModel(new FTableTableModel(ftables));
        ftableTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        /*
         * ftableTable.getTableHeader().getColumnModel().getColumn(0).setPreferredWidth(25);
         * ftableTable.getTableHeader().getColumnModel().getColumn(0).setMaxWidth(25);
         * ftableTable.getTableHeader().getColumnModel().getColumn(0).setMinWidth(25);
         * ftableTable.getTableHeader().getColumnModel().getColumn(1).setPreferredWidth(30);
         * ftableTable.getTableHeader().getColumnModel().getColumn(1).setMaxWidth(30);
         * ftableTable.getTableHeader().getColumnModel().getColumn(1).setMinWidth(30);
         */
        ftableTable.getTableHeader().setReorderingAllowed(false);
        ftableTable.addKeyListener(new KeyAdapter() {
            @Override
            public void keyReleased(KeyEvent e) {
                if (e.getKeyCode() == 127) {
                    removeFTable();
                }
            }
        });

        ftableTable.getSelectionModel().addListSelectionListener(
                new ListSelectionListener() {
                    public void valueChanged(ListSelectionEvent e) {
                        if (e.getValueIsAdjusting()) {
                            return;
                        } else {
                            int index = ftableTable.getSelectedRow();
                            if (index != -1) {
                                // instrumentView.removeAll();

                                focusedFTable = (FTable) ftables.get(index);

                                // instrumentView.add(focusedInstrument.getGUI(),
                                // BorderLayout.CENTER);
                                /*
                                 * enableProperties();
                                 * iNumText.setText(currentInstrumentNumber.toString());
                                 * iNameText.setText(focusedInstrument.getName());
                                 * commentText.setText(focusedInstrument.getComment());
                                 * instrumentView.revalidate();
                                 * instrumentView.repaint();
                                 */
                            }
                        }
                    }
                });

        addFTableButton.addActionListener(new java.awt.event.ActionListener() {
            public void actionPerformed(ActionEvent e) {
                addFTable(new FTable());
            }
        });
        removeFTableButton
                .addActionListener(new java.awt.event.ActionListener() {
                    public void actionPerformed(ActionEvent e) {
                        removeFTable();
                    }
                });
    }

    public void setData(BlueData data) {
        /*
         * this.data = data; this.ftables = data.getFTables();
         * ftableTable.setModel(new FTableTableModel(ftables));
         * ftableTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
         * 
         * this.setColumnWidth(0, 40); this.setColumnWidth(1, 80);
         * this.setColumnWidth(2, 80); this.setColumnWidth(3, 80);
         * 
         * 
         * ftableTable.getTableHeader().setReorderingAllowed(false);
         */
    }

    private void setColumnWidth(int columnNum, int width) {
        ftableTable.getTableHeader().getColumnModel().getColumn(columnNum)
                .setPreferredWidth(width);
        ftableTable.getTableHeader().getColumnModel().getColumn(columnNum)
                .setMaxWidth(width);
        ftableTable.getTableHeader().getColumnModel().getColumn(columnNum)
                .setMinWidth(width);
    }

    private void addFTable(FTable ft) {
        ftables.addFTable(ft);
        ftableTable.revalidate();
        ftableTable.repaint();
    }

    private void removeFTable() {
        if (focusedFTable != null) {
            ftableTable.clearSelection();
            ftables.remove(focusedFTable);
            focusedFTable = null;
            ftableTable.revalidate();
            ftableTable.repaint();
        }
    }

    /* UNIT TEST */
    public static void main(String args[]) {
        JFrame mFrame = new JFrame();
        mFrame.setSize(800, 600);
        FTableGUI a = new FTableGUI();
        mFrame.getContentPane().add(a);

        /*
         * for(int i = 0; i < 20; i++) { Instrument temp = new
         * GenericInstrument(); temp.setName("temp" + i); a.addInstrument(temp); }
         */

        mFrame.show();
        mFrame.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                System.exit(0);

            }
        });
    }

}