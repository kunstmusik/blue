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
package blue.components;

import blue.ui.utilities.FileChooserManager;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.IOException;
import java.util.List;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JFileChooser;
import javax.swing.JLabel;
import javax.swing.JTextField;



/**
 * @author steven
 * 
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */
public class FileSelectionPanel extends JComponent {

    private static final String DEFAULT_FILE_MANAGER_GROUP = "fileSelectionPanel";

    private String title;

    private File selectedFile;

    private JTextField fileNameText = new JTextField();

    private JLabel fileLabel = new JLabel();

    private String fileManagerGroup;

    public FileSelectionPanel(String fileManagerGroup) {
        this.fileManagerGroup = fileManagerGroup == null ? DEFAULT_FILE_MANAGER_GROUP
                : fileManagerGroup;
        this.setLayout(new BorderLayout());

        JButton fileButton = new JButton("...");

        fileButton.addActionListener((ActionEvent e) -> {
            selectFile();
        });

        this.add(fileLabel, BorderLayout.WEST);
        this.add(fileNameText, BorderLayout.CENTER);
        this.add(fileButton, BorderLayout.EAST);

    }

    protected void selectFile() {
        FileChooserManager.getDefault().setDialogTitle(this.fileManagerGroup, "Choose File");

        final Frame mainWindow = WindowManager.getDefault().getMainWindow();
        
        List<File> retVal = FileChooserManager.getDefault().showOpenDialog(this.fileManagerGroup,
                mainWindow);

        if (retVal.isEmpty()) {
            return;
        }

        File temp = retVal.get(0);
        this.setSelectedFile(temp);
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getTitle() {
        return title;
    }

    public File getSelectedFile() {
        return selectedFile;
    }

    public void setSelectedFile(File selectedFile) {
        this.selectedFile = selectedFile;
    }

    public String getSelectedFileName() {
        try {
            return selectedFile.getCanonicalPath();
        } catch (IOException e) {
            return "";
        }
    }

    public void setSelectedFileName(final String fileName) {
        selectedFile = new File(fileName);

        String displayText;

        try {
            displayText = selectedFile.getCanonicalPath();
        } catch (IOException e) {
            displayText = "";
        }
        this.fileNameText.setText(displayText);
    }

    public static void main(String[] args) {

    }

}