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
package blue.projects;

import blue.utility.GUI;
import com.l2fprod.common.swing.BaseDialog;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.table.AbstractTableModel;

public class AudioFileDependencyDialog extends BaseDialog {

    DependencyTableModel model = new DependencyTableModel();

    JFileChooser fChooser = null;

    public AudioFileDependencyDialog() {
        super((JFrame) null, "Audio File Dependencies", true);
        this.getBanner().setTitle("Locate Missing Audio Files");

        this.setModal(true);

        this.setDefaultCloseOperation(HIDE_ON_CLOSE);

        final JTable table = new JTable(model);

        table.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent e) {
                int row = table.getSelectedRow();

                if (row >= model.getRowCount()) {
                    return;
                }

                if (e.getClickCount() == 2) {
                    if (fChooser == null) {
                        fChooser = new JFileChooser();
                        fChooser.setDialogTitle("Choose Replacement File");
                    }

                    int retVal = fChooser.showOpenDialog(null);

                    File f = fChooser.getSelectedFile();

                    if (retVal == JFileChooser.APPROVE_OPTION) {
                        model.setValueAt(f.getPath(), row, 1);
                    }
                }
            }

        });

        JScrollPane jsp = new JScrollPane(table);

        this.getContentPane().add(jsp);

        this.setSize(400, 500);

        GUI.centerOnScreen(this);
    }

    public void setFilesList(ArrayList filesList) {
        model.setFilesList(filesList);
    }

    public HashMap getFilesMap() {
        return model.getFilesMap();
    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        AudioFileDependencyDialog aDialog = new AudioFileDependencyDialog();
        ArrayList<String> fList = new ArrayList<>();

        fList.add("test1");
        fList.add("test2");
        fList.add("test3");

        aDialog.setFilesList(fList);
        boolean value = aDialog.ask();
        System.exit(0);
    }

    static class DependencyTableModel extends AbstractTableModel {

        ArrayList filesList = null;

        ArrayList returnList = null;

        public void setFilesList(ArrayList filesList) {
            this.filesList = filesList;
            this.returnList = new ArrayList();

            for (int i = 0; i < filesList.size(); i++) {
                returnList.add("");
            }
        }

        @Override
        public int getColumnCount() {
            // TODO Auto-generated method stub
            return 2;
        }

        @Override
        public int getRowCount() {
            return (filesList == null) ? 0 : filesList.size();
        }

        @Override
        public Object getValueAt(int rowIndex, int columnIndex) {
            if (columnIndex == 0) {
                return filesList.get(rowIndex);
            }

            return returnList.get(rowIndex);

        }

        // public boolean isCellEditable(int rowIndex, int columnIndex) {
        // return columnIndex == 1;
        // }

        @Override
        public void setValueAt(Object aValue, int rowIndex, int columnIndex) {
            if (columnIndex != 1) {
                return;
            }

            returnList.set(rowIndex, aValue);
            fireTableCellUpdated(rowIndex, columnIndex);
        }

        @Override
        public String getColumnName(int column) {
            if (column == 0) {
                return "Original File";
            }
            return "New File";
        }

        public HashMap getFilesMap() {
            HashMap filesMap = new HashMap();

            for (int i = 0; i < filesList.size(); i++) {
                String key = (String) filesList.get(i);
                String val = (String) returnList.get(i);

                if (!key.equals(val) && !val.equals("") && val != null) {
                    filesMap.put(key, val);
                }
            }

            return filesMap;
        }

    }
}
