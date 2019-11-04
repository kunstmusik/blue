/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as
published
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

package blue.gui;

/**
 * @author Steven Yi
 * 
 */

import blue.BlueSystem;
import blue.ui.utilities.UiUtilities;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Vector;
import javax.swing.BorderFactory;
import javax.swing.DefaultComboBoxModel;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.ListCellRenderer;
import org.openide.util.ImageUtilities;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class FileTree extends JComponent {
    private static final Comparator<File> c = new AlphabeticalFileComparator();

    private ArrayList<FileTreeListener> listeners = new ArrayList<>();
    
    JList<File> directoryList = new JList<>();

    JScrollPane fileListScrollPane = new JScrollPane();

    JList<File> fileList = new JList<>();

    FileListCellRenderer flcRenderer = new FileListCellRenderer();

    JButton driveButton = new JButton("<");

    JComboBox<File> dirList = new JComboBox<>();

    boolean listUpdating = false;

    DriveSelectorPopupMenu drives = new DriveSelectorPopupMenu();

    String[] filenameExtensions = null;

    private FileTreePopup fileTreePopup;

    public FileTree() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void addFileTreeListener(FileTreeListener fileTreeListener) {
        this.listeners.add(fileTreeListener);
    }
    
    public void addFileTreePopup(FileTreePopup fileTreePopup) {
        this.fileTreePopup = fileTreePopup;
    }

    private void jbInit() throws Exception {
        this.setLayout(new BorderLayout());

        fileList.addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                                
                if (listUpdating) {
                    return;
                }

                listUpdating = true;
                File f = fileList.getSelectedValue();

                if (e.getClickCount() == 2) {

                    if (f.isDirectory()) {
                        if (!f.canRead()) {
                            JOptionPane
                                    .showMessageDialog(
                                            null,
                                            BlueSystem
                                                    .getString("soundfile.manager.error.noAccess"),
                                            BlueSystem
                                                    .getString("message.error"),
                                            JOptionPane.PLAIN_MESSAGE);
                            listUpdating = false;
                            return;
                        }
                        populateDirectory(f);
                        populateFiles(f);
                    } else if (f.isFile()) {
                        fireFileSelected(f);
                    }
                } else {

                    if (UiUtilities.isRightMouseButton(e)) {
                        if (fileTreePopup != null) {
                            fileTreePopup.show(f, e.getComponent(), e.getX(), e
                                    .getY());
                        }
                    }

                }
                listUpdating = false;
            }

        });

        driveButton.addActionListener((ActionEvent e) -> {
            showDrivePopup();
        });

        driveButton.setPreferredSize(new Dimension(26, 26));
        driveButton.setText("...");

        JPanel driveDirPanel = new JPanel();
        driveDirPanel.setLayout(new BorderLayout());

        driveDirPanel.add(dirList, BorderLayout.CENTER);
        driveDirPanel.add(driveButton, BorderLayout.EAST);

        this.add(driveDirPanel, BorderLayout.NORTH);
        this.add(fileListScrollPane, BorderLayout.CENTER);
        fileListScrollPane.getViewport().add(fileList);
        fileList.setCellRenderer(flcRenderer);

        dirList.addActionListener((ActionEvent e) -> {
            if (!listUpdating) {
                listUpdating = true;
                File dir =  (File)dirList.getSelectedItem();
                populateDirectory(dir);
                populateFiles(dir);
                listUpdating = false;
            }
        });

        listUpdating = true;
        File homeDir = new File(System.getProperty("user.home"));
        this.populateDirectory(homeDir);
        this.populateFiles(homeDir);
        listUpdating = false;

    }

    protected void fireFileSelected(File f) {
        for (int i = 0; i < listeners.size(); i++) {
            FileTreeListener ftl = listeners.get(i);
            ftl.fileSelected(f);
        }
    }
       
    public void setDrive(File drive) {
        this.listUpdating = true;
        this.populateDirectory(drive);
        this.populateFiles(drive);
        this.listUpdating = false;
    }

    private void populateDirectory(File dir) {
        // populate the selected dir and all its parents
        flcRenderer.setSelectedDir(dir);

        Vector<File> parentList = new Vector<>();

        File tempDir = dir;
        parentList.add(dir);

        while ((tempDir = tempDir.getParentFile()) != null) {
            parentList.add(0, tempDir);
        }

        dirList.setModel(new DefaultComboBoxModel<>(parentList));
        dirList.setSelectedIndex(parentList.size() - 1);
    }

    private boolean populateFiles(File dir) {
        File[] files = dir.listFiles();
        Arrays.sort(files, c);

        Vector<File> v = new Vector<>();
        String fileName;

        v.add(dir);

        if (dir.getParentFile() != null) {
            v.add(dir.getParentFile());
        }

        for (int i = 0; i < files.length; i++) {
            if (files[i].getName().startsWith(".")) {
                continue;
            }
            if (files[i].isFile()) {
                fileName = files[i].getName();

                if (filter(fileName)) {
                    v.add(files[i]);
                }
            } else if (files[i].isDirectory()) {
                v.add(files[i]);
            }

        }

        fileList.setListData(v);
        return true;
    }

    private boolean filter(String fileName) {
        if (filenameExtensions == null) {
            return false;
        }
        for (int i = 0; i < filenameExtensions.length; i++) {
            if (fileName.toLowerCase().endsWith(filenameExtensions[i])) {
                return true;
            }
        }
        return false;
    }

    public void setFilters(String[] filenameExtensions) {
        this.filenameExtensions = filenameExtensions;
    }

    public void showDrivePopup() {
        drives.show(this, driveButton.getX(), driveButton.getY()
                + driveButton.getHeight());
    }

    // unit test
    public static void main(String[] args) {
        JFrame mFrame = new JFrame();
        mFrame.setSize(800, 600);
        FileTree soundFileManager1 = new FileTree();
        mFrame.getContentPane().add(soundFileManager1);

        mFrame.setVisible(true);
        mFrame.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                System.exit(0);
            }
        });
    }

}

class FileListCellRenderer extends JLabel implements ListCellRenderer<File> {
    private static ImageIcon dirIcon = new ImageIcon(
            ImageUtilities.loadImage("blue/resources/images/Directory.gif"));

    private File selectedDir;

    public FileListCellRenderer() {
        setOpaque(true);
        this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
    }

    public void setSelectedDir(File dir) {
        this.selectedDir = dir;
    }

    @Override
    public Component getListCellRendererComponent(JList<? extends File> list, File f,
            int index, boolean isSelected, boolean hasCellFocus) {
        File parentDir = selectedDir.getParentFile();

        if (f == selectedDir) {
            this.setText(".");
        } else if (selectedDir != null && parentDir != null
                && f.toString().equals(parentDir.toString())) {
            this.setText("..");
        } else {
            this.setText(f.getName());
        }

        if (f.isDirectory()) {
            this.setIcon(dirIcon);
        } else {
            this.setIcon(null);
        }
        setBackground(isSelected ? list.getSelectionBackground() : list
                .getBackground());
        setForeground(isSelected ? list.getSelectionForeground() : list
                .getForeground());
        return this;
    }
}

class DriveSelectorPopupMenu extends JPopupMenu implements ActionListener {
    FileTree fileTree;

    public DriveSelectorPopupMenu() {
        File[] drives = File.listRoots();
        JMenuItem temp;

        for (int i = 0; i < drives.length; i++) {
            temp = new JMenuItem(drives[i].getAbsolutePath());
            temp.setActionCommand(drives[i].getAbsolutePath());
            temp.addActionListener(this);
            this.add(temp);

        }

    }

    public void show(FileTree fileTree, int x, int y) {
        this.fileTree = fileTree;
        super.show(fileTree, x, y);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        File drive = new File(e.getActionCommand());
        fileTree.setDrive(drive);
    }
}

class AlphabeticalFileComparator implements Comparator<File> {
    @Override
    public int compare(File a, File b) {
        return a.getName().compareTo(b.getName());
    }
}
