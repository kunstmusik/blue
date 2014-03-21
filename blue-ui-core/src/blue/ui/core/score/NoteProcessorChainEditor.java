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
package blue.ui.core.score;

import blue.BlueSystem;
import blue.noteProcessor.NoteProcessor;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorChainMap;
import blue.ui.core.BluePluginManager;
import blue.ui.core.score.noteProcessorChain.NoteProcessorChainTable;
import blue.ui.core.score.noteProcessorChain.NoteProcessorChainTableModel;
import blue.ui.utilities.UiUtilities;
import blue.utility.ObjectUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.border.Border;
import javax.swing.border.TitledBorder;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;
import org.openide.util.Exceptions;

/**
 * @author steven
 */
public class NoteProcessorChainEditor extends JComponent {

    private NoteProcessorPopup noteProcPopup = new NoteProcessorPopup(this);

    private EditPopup editPopup = new EditPopup(this);

    NoteProcessorChain npc;

    protected NoteProcessorChainTableModel npcModel;

    NoteProcessorChainTable npcTable;

    JButton addButton = new JButton();

    JButton removeButton = new JButton();

    JButton pushUpButton = new JButton();

    JButton pushDownButton = new JButton();

    JPanel topPanel;

    JPanel noteProcessorEditPanel = new JPanel();

    CardLayout noteProcessorCardLayout = new CardLayout();

    private static NoteProcessor buffer;

    public NoteProcessorChainEditor() {
        this.setPreferredSize(new Dimension(300, 300));
        this.setLayout(new BorderLayout());

        Border border1 = BorderFactory.createLineBorder(Color.darkGray, 1);

        Border titledBorder1 = new TitledBorder(
                border1,
                " "
                + BlueSystem
                .getString("soundObjectProperties.noteProcessors.title")
                + " ");

        Border border2 = BorderFactory.createCompoundBorder(titledBorder1,
                BorderFactory.createEmptyBorder(5, 5, 5, 5));

        this.setBorder(border2);

        topPanel = new JPanel();
        topPanel.add(addButton);
        topPanel.add(removeButton);
        topPanel.add(pushUpButton);
        topPanel.add(pushDownButton);

        JScrollPane jsp = new JScrollPane();

        JPanel editPanel = new JPanel();
        editPanel.setLayout(new BorderLayout());
        editPanel.add(topPanel, BorderLayout.NORTH);
        editPanel.add(jsp, BorderLayout.CENTER);

        npcModel = new NoteProcessorChainTableModel();
        npcTable = new NoteProcessorChainTable(npcModel);

        jsp.setViewportView(npcTable);

        npcTable.addMouseListener(new MouseAdapter() {

            @Override
            public void mousePressed(MouseEvent me) {
                npcModel.setCurrentNoteProcessor(npcTable.getSelectedRow());
                updateHilightRows();
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                if (UiUtilities.isRightMouseButton(e)) {
                    editPopup.show(npcTable, e.getX(), e.getY());
                }
            }
        });

        addButton.setToolTipText(BlueSystem
                .getString("soundObjectProperties.noteProcessors.add"));
        addButton.setText("+");
        addButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                showNoteProcessorPopup(e);
            }
        });
        removeButton.setToolTipText(BlueSystem
                .getString("soundObjectProperties.noteProcessors.remove"));
        removeButton.setText("-");
        removeButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                removeCurrentNoteProcessor();
            }
        });
        pushUpButton.setToolTipText(BlueSystem
                .getString("soundObjectProperties.noteProcessors.pushUp"));
        pushUpButton.setText("^");
        pushUpButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                pushUpNoteProcessor(e);
            }
        });
        pushDownButton.setToolTipText(BlueSystem
                .getString("soundObjectProperties.noteProcessors.pushDown"));
        pushDownButton.setText("V");
        pushDownButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                pushDownNoteProcessor(e);
            }
        });

        noteProcessorEditPanel.setLayout(noteProcessorCardLayout);
        noteProcessorEditPanel.add(editPanel, "edit");
        noteProcessorEditPanel
                .add(
                        new JLabel(
                                BlueSystem
                                .getString(
                                        "soundObjectProperties.noteProcessors.notSupported")),
                        "unsupported");
        noteProcessorCardLayout.show(noteProcessorEditPanel, "unsupported");

        this.add(noteProcessorEditPanel, BorderLayout.CENTER);

    }

    private void updateHilightRows() {
        int hilightRows[] = npcModel.getHilightRows();
        npcTable.setHilightRows(hilightRows);
    }

    public void setNoteProcessorChainMap(NoteProcessorChainMap npcMap) {
        noteProcPopup.setNoteProcessorChainMap(npcMap);
    }

    public void setNoteProcessorChain(NoteProcessorChain npc) {
        if (npcTable.isEditing()) {
            npcTable.getCellEditor().stopCellEditing();
        }

        this.npc = npc;
        npcModel.setNoteProcessorChain(npc);

        if (npc == null) {
            noteProcessorCardLayout.show(noteProcessorEditPanel, "unsupported");
        } else {
            noteProcessorCardLayout.show(noteProcessorEditPanel, "edit");
        }
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return this.npc;
    }

    void showNoteProcessorPopup(ActionEvent e) {
        if (npc == null) {
            return;
        }

        noteProcPopup.show(topPanel, addButton.getX(), addButton.getY()
                + addButton.getHeight());
    }

    protected void cutCurrentNoteProcessor() {
        if (npc == null) {
            return;
        }

        buffer = npcModel.getCurrentNoteProcessor();
        npcModel.removeNoteProcessor();
    }

    protected void pasteCurrentNoteProcessor() {
        if (npc == null || buffer == null) {
            return;
        }

        NoteProcessor clone = (NoteProcessor) ObjectUtilities.clone(buffer);
        npcModel.addNoteProcessor(clone);
    }

    protected void copyCurrentNoteProcessor() {
        if (npc == null) {
            return;
        }

        buffer = npcModel.getCurrentNoteProcessor();
    }

    void removeCurrentNoteProcessor() {
        if (npc == null) {
            return;
        }

        npcModel.removeNoteProcessor();
        updateHilightRows();
    }

    void pushUpNoteProcessor(ActionEvent e) {
        if (npc == null) {
            return;
        }

        npcModel.pushUpNoteProcessor();
        updateHilightRows();
    }

    void pushDownNoteProcessor(ActionEvent e) {
        if (npc == null) {
            return;
        }

        npcModel.pushDownNoteProcessor();
        updateHilightRows();
    }

    public void addNoteProcessor(NoteProcessor np) {
        npcModel.addNoteProcessor(np);
        updateHilightRows();
    }

    static class NoteProcessorPopup extends JPopupMenu implements
            ActionListener {

        NoteProcessorChainMap npcMap;

        NoteProcessorChainEditor npcEditor;

        ActionListener insertChainListener;

        HashMap<String, Class> npNameClassMap = new HashMap<>();

        private JMenuItem saveChain;

        private JMenu insertChain = new JMenu("Insert");

        private JMenuItem removeChain;

        public NoteProcessorPopup(NoteProcessorChainEditor npcEditor) {
            this.npcEditor = npcEditor;

            FileObject npFiles[] = FileUtil.getConfigFile("blue/noteProcessors").getChildren();
            List<FileObject> ordereNpFiles
                    = FileUtil.getOrder(Arrays.asList(npFiles), true);

            JMenuItem temp;

            JMenu insertNoteProcessor = new JMenu("Insert Note Processor");

            for (FileObject fObj : ordereNpFiles) {
                String name = (String) fObj.getAttribute("displayName");
                System.out.println("NoteProcessor Name: " + name);
                temp = new JMenuItem();
                temp.setText(name);
                temp.setActionCommand(fObj.getPath());
                temp.addActionListener(this);
                insertNoteProcessor.add(temp);
            }

            insertChainListener = new ActionListener() {

                @Override
                public void actionPerformed(ActionEvent e) {
                    insertChain(e.getActionCommand());
                }
            };

            saveChain = new JMenuItem("Save");
            saveChain.addActionListener(new ActionListener() {

                @Override
                public void actionPerformed(ActionEvent e) {
                    saveChain();
                }
            });

            removeChain = new JMenuItem("Remove");
            removeChain.addActionListener(new ActionListener() {

                @Override
                public void actionPerformed(ActionEvent e) {
                    removeChain();
                }
            });

            JMenu npcMapMenu = new JMenu("Note Processor Chains");

            npcMapMenu.add(saveChain);
            npcMapMenu.add(insertChain);
            npcMapMenu.add(removeChain);

            this.add(insertNoteProcessor);
            this.add(npcMapMenu);

            this.addPopupMenuListener(new PopupMenuListener() {

                @Override
                public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                    updateNoteProcessorChainMenuStatus();
                }

                @Override
                public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
                }

                @Override
                public void popupMenuCanceled(PopupMenuEvent e) {
                }
            });
        }

        /**
         * @param actionCommand
         */
        protected void insertChain(String npcName) {
            if (npcMap == null) {
                return;
            }

            NoteProcessorChain npc = npcMap.getNoteProcessorChain(npcName);

            if (npc == null) {
                return;
            }

            npc = (NoteProcessorChain) npc.clone();

            for (Iterator iter = npc.iterator(); iter.hasNext();) {
                NoteProcessor np = (NoteProcessor) iter.next();
                npcEditor.addNoteProcessor(np);
            }

        }

        public void setNoteProcessorChainMap(NoteProcessorChainMap npcMap) {
            this.npcMap = npcMap;
            updateNPCMapMenu();
        }

        /**
         *
         */
        private void updateNPCMapMenu() {
            if (npcMap == null) {
                return;
            }

            insertChain.removeAll();

            for (Iterator iter = npcMap.keySet().iterator(); iter.hasNext();) {
                String name = (String) iter.next();

                JMenuItem item = new JMenuItem();
                item.setText(name);
                item.setActionCommand(name);
                item.addActionListener(insertChainListener);

                insertChain.add(item);

            }

        }

        /**
         *
         */
        protected void saveChain() {
            if (npcMap == null || npcEditor.getNoteProcessorChain().size() == 0) {
                return;
            }

            Object retVal = JOptionPane.showInputDialog(null,
                    "Name of Note Processor Chain");

            if (retVal == null) {
                return;
            }

            String name = (String) retVal;

            NoteProcessorChain npc = npcEditor.getNoteProcessorChain();

            if (npc != null) {
                npcMap.put(name, npc);
                updateNPCMapMenu();
            }

        }

        /**
         *
         */
        protected void removeChain() {
            if (npcMap == null || npcMap.size() == 0) {
                return;
            }

            Object[] names = npcMap.keySet().toArray();

            Object retVal = JOptionPane.showInputDialog(null,
                    "Select Chain to Remove", "Remove Chain",
                    JOptionPane.INFORMATION_MESSAGE, null, names, names[0]);

            if (retVal == null) {
                return;
            }

            String name = (String) retVal;

            npcMap.remove(name);
            updateNPCMapMenu();

        }

        @Override
        public void actionPerformed(ActionEvent ae) {
            NoteProcessor npTemplate = FileUtil.getConfigObject(ae.getActionCommand(),
                    NoteProcessor.class);
            try {
                NoteProcessor np = npTemplate.getClass().newInstance();
                npcEditor.addNoteProcessor(np);
            } catch (InstantiationException | IllegalAccessException ex) {
                Exceptions.printStackTrace(ex);
            }
        }

        private void updateNoteProcessorChainMenuStatus() {
            if (npcMap == null) {
                saveChain.setEnabled(false);
                insertChain.setEnabled(false);
                removeChain.setEnabled(false);
                return;
            }

            boolean canSave = (npcEditor.getNoteProcessorChain().size() != 0);

            saveChain.setEnabled(canSave);

            boolean hasChains = (npcMap.size() != 0);

            insertChain.setEnabled(hasChains);
            removeChain.setEnabled(hasChains);

        }
    }

    static class EditPopup extends JPopupMenu {

        private NoteProcessorChainEditor npcEditor;

        private JMenuItem removeProcessor = new JMenuItem();

        private JMenuItem cutProcessor = new JMenuItem();

        private JMenuItem copyProcessor = new JMenuItem();

        private JMenuItem pasteProcessor = new JMenuItem();

        public EditPopup(final NoteProcessorChainEditor npcEditor) {
            this.npcEditor = npcEditor;

            cutProcessor.setText("Cut");
            cutProcessor.addActionListener(new ActionListener() {

                @Override
                public void actionPerformed(ActionEvent e) {
                    npcEditor.cutCurrentNoteProcessor();
                }
            });

            copyProcessor.setText("Copy");
            copyProcessor.addActionListener(new ActionListener() {

                @Override
                public void actionPerformed(ActionEvent e) {
                    npcEditor.copyCurrentNoteProcessor();
                }
            });

            pasteProcessor.setText("Paste");
            pasteProcessor.addActionListener(new ActionListener() {

                @Override
                public void actionPerformed(ActionEvent e) {
                    npcEditor.pasteCurrentNoteProcessor();
                }
            });

            removeProcessor.setText(BlueSystem
                    .getString("soundObjectProperties.noteProcessors.remove"));
            removeProcessor.addActionListener(new ActionListener() {

                @Override
                public void actionPerformed(ActionEvent e) {
                    npcEditor.removeCurrentNoteProcessor();
                }
            });

            this.add(cutProcessor);
            this.add(copyProcessor);
            this.add(pasteProcessor);
            this.addSeparator();
            this.add(removeProcessor);

            this.pack();
        }

        @Override
        public void show(Component invoker, int x, int y) {
            pasteProcessor.setEnabled(NoteProcessorChainEditor.buffer != null);

            NoteProcessor currentNoteProcessor = npcEditor.npcModel.getCurrentNoteProcessor();

            pasteProcessor.setEnabled(NoteProcessorChainEditor.buffer != null);
            cutProcessor.setEnabled(currentNoteProcessor != null);
            copyProcessor.setEnabled(currentNoteProcessor != null);

            removeProcessor.setEnabled(currentNoteProcessor != null);

            super.show(invoker, x, y);
        }

    }

}
