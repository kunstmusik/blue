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

package blue.orchestra.editor.blueSynthBuilder;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.io.IOException;

import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;

import blue.BlueSystem;
import blue.orchestra.blueSynthBuilder.BSBFileSelector;
import blue.ui.utilities.FileChooserManager;

/**
 * @author steven
 * @author Michael Bechard
 */

public class BSBFileSelectorView extends BSBObjectView {
    private static final int FILE_BUTTON_WIDTH = 30;

    private static int OBJECT_HEIGHT = 30;

    private static String FILE_SELECTOR_ID = "BSBFileSelector";

    private final BSBFileSelector selector;

    JTextField fileNameField = new JTextField();
    
    private BSBFileSelectorPopup popup;

    public BSBFileSelectorView(BSBFileSelector _selector) {
        this.selector = _selector;
        setBSBObject(selector);
        popup = new BSBFileSelectorPopup(this);

        fileNameField.setEditable(false);

        JButton fileButton = new JButton("...");
        fileButton.addActionListener(new ActionListener() {

            public void actionPerformed(ActionEvent e) {

                String fileName = selector.getFileName();

                if (fileName != null && fileName.trim().length() > 0) {
                    File file = BlueSystem.findFile(fileName);

                    if (file != null) {
                        FileChooserManager.getDefault().setSelectedFile(FILE_SELECTOR_ID,
                                file);
                    }
                }

                int rValue = FileChooserManager.getDefault().showOpenDialog(
                        FILE_SELECTOR_ID, null);

                if (rValue == JFileChooser.APPROVE_OPTION) {
                    File f = FileChooserManager.getDefault()
                            .getSelectedFile(FILE_SELECTOR_ID);
                    
                    try {
                        String absFilePath = f.getCanonicalPath();
                        String relPath = BlueSystem.getRelativePath(absFilePath);
                        
                        System.out.println("Rel Path: " + relPath);
                        selector.setFileName(relPath);
                        updateDisplay();
                    } catch (IOException e1) {
                        // TODO Auto-generated catch block
                        e1.printStackTrace();
                    }
                    
                }
            }

        });

        fileButton.setPreferredSize(new Dimension(FILE_BUTTON_WIDTH,
                OBJECT_HEIGHT));

        this.setSize(selector.getTextFieldWidth() + FILE_BUTTON_WIDTH,
                OBJECT_HEIGHT);

        this.setLayout(new BorderLayout());
        this.add(fileNameField, BorderLayout.CENTER);
        this.add(fileButton, BorderLayout.EAST);

        fileNameField.addMouseListener(new MouseAdapter() {
            public void mousePressed(MouseEvent e) {
                requestFocus();
                if (SwingUtilities.isRightMouseButton(e)) {
                    popup.show(BSBFileSelectorView.this, e.getX(), e.getY());
                }
            }
        });
        
        updateDisplay();
        revalidate();
    }

    protected void updateDisplay() {
        fileNameField.setText(selector.getFileName());
    }

    public int getTextFieldWidth() {
        return selector.getTextFieldWidth();
    }

    public void setTextFieldWidth(int textFieldWidth) {
        Dimension d = new Dimension(textFieldWidth, fileNameField.getHeight());

        fileNameField.setPreferredSize(d);
        fileNameField.setSize(d);

        d = new Dimension(textFieldWidth + FILE_BUTTON_WIDTH, OBJECT_HEIGHT);

        this.setPreferredSize(d);
        this.setSize(d);

        selector.setTextFieldWidth(textFieldWidth);

        revalidate();
    }
    
    public void resetText() {
        selector.setFileName("");
        updateDisplay();
    }

    public void cleanup() {}
}
