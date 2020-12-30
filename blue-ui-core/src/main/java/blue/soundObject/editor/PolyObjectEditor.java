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

package blue.soundObject.editor;

import blue.Arrangement;
import blue.BlueData;
import blue.BlueSystem;
import blue.CompileData;
import blue.GlobalOrcSco;
import blue.Tables;
import blue.gui.InfoDialog;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.projects.BlueProjectManager;
import blue.score.ScoreObject;
import blue.soundObject.NoteList;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.udo.OpcodeList;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.util.List;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.SwingUtilities;
import javax.swing.event.ListSelectionEvent;
import javax.swing.table.AbstractTableModel;
import org.openide.util.Exceptions;

/**
 * Title: blue (Object Composition Environment) Description: Copyright:
 * Copyright (c) steven yi Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

// TODO - Clean up UI Code in this class
@ScoreObjectEditorPlugin(scoreObjectType = PolyObject.class)
public class PolyObjectEditor extends ScoreObjectEditor {

    PolyObject pObj;

    SoundObjectTableModel sObjTableModel = new SoundObjectTableModel();

    BorderLayout borderLayout1 = new BorderLayout();

    JLabel pObjLabel = new JLabel();

    JSplitPane mainSplitPane = new JSplitPane();

    JScrollPane sObjScrollPane = new JScrollPane();

    JTable sObjTable = new JTable();

    JPanel sObjPropPanel = new JPanel();

    MimeTypeEditorComponent sObjScoreDisplay = 
            new MimeTypeEditorComponent("text/x-csound-sco");

    BorderLayout borderLayout2 = new BorderLayout();

    JPanel topPanel = new JPanel();

    JLabel nameLabel = new JLabel();

    GridLayout gridLayout1 = new GridLayout();

    JLabel sObjScoreLabel = new JLabel();

    JLabel typeText = new JLabel();

    JLabel typeLabel = new JLabel();

    JLabel nameText = new JLabel();

    List<SoundObject> sObjects;

    JButton testButton = new JButton();

    public PolyObjectEditor() {
        try {
            jbInit();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void jbInit() throws Exception {
        this.setBorder(BorderFactory.createEmptyBorder(3, 3, 3, 3));
        this.setLayout(borderLayout1);
        pObjLabel.setText(BlueSystem.getString("polyObject.browser"));
        sObjScrollPane.setBorder(null);
        sObjScrollPane.setMinimumSize(new Dimension(0, 0));
        // sObjects = pObj.getSoundObjects();
        sObjTable.setModel(sObjTableModel);

        sObjScoreDisplay.setText(BlueSystem
                .getString("polyObject.selectToDisplay"));
        sObjScoreDisplay.getJEditorPane().setEditable(false);
        sObjPropPanel.setLayout(borderLayout2);
        sObjPropPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        nameLabel.setToolTipText("");
        nameLabel.setText(BlueSystem.getString("soundObjectProperties.name"));
        topPanel.setLayout(gridLayout1);
        gridLayout1.setRows(3);
        gridLayout1.setColumns(2);
        gridLayout1.setVgap(3);
        sObjScoreLabel.setText(BlueSystem.getString("polyObject.sObjScore"));
        sObjScoreLabel.setBorder(BorderFactory.createEmptyBorder(5, 0, 5, 0));
        typeLabel.setText(BlueSystem.getString("common.typeLabel"));

        JPanel headerPanel = new JPanel();

        testButton.setText(BlueSystem.getString("common.test"));
        testButton.addActionListener((ActionEvent e) -> {
            testSoundObject();
        });

        headerPanel.setLayout(new BorderLayout());
        headerPanel.add(pObjLabel, BorderLayout.CENTER);
        headerPanel.add(testButton, BorderLayout.EAST);

        this.add(headerPanel, BorderLayout.NORTH);
        this.add(mainSplitPane, BorderLayout.CENTER);
        mainSplitPane.add(sObjScrollPane, JSplitPane.LEFT);
        mainSplitPane.add(sObjPropPanel, JSplitPane.RIGHT);
        sObjPropPanel.add(sObjScoreDisplay, BorderLayout.CENTER);
        sObjPropPanel.add(topPanel, BorderLayout.NORTH);
        topPanel.add(nameLabel, null);
        topPanel.add(nameText, null);
        topPanel.add(typeLabel, null);
        topPanel.add(typeText, null);
        topPanel.add(sObjScoreLabel, null);

        sObjScrollPane.getViewport().add(sObjTable, null);
        mainSplitPane.setDividerLocation(300);
        sObjTable.getSelectionModel().addListSelectionListener((ListSelectionEvent e) -> {
            if (pObj == null || e.getValueIsAdjusting()) {
                return;
            }
            
            int index = sObjTable.getSelectedRow();
            if (index != -1) {
                populate(sObjects.get(index));
            }
        });
    }

    @Override
    public void editScoreObject(ScoreObject sObj) {
        if (sObj == null) {
            System.err
                    .println("[PolyObjectEditor::editSoundObject()] ERROR: not an instance of polyObject");
            pObj = null;
            sObjTableModel.setSoundObjects(null);
            return;
        }

        if (!sObj.getClass().getName().equals("blue.soundObject.PolyObject")) {
            System.err
                    .println("[PolyObjectEditor::editSoundObject()] ERROR: not an instance of polyObject");
            pObj = null;
            sObjTableModel.setSoundObjects(null);
            return;
        }

        this.pObj = (PolyObject) sObj;
        sObjects = pObj.getSoundObjects(true);
        sObjTableModel.setSoundObjects(sObjects);
        this.clear();
    }

    public void populate(SoundObject sObj) {
        nameLabel.setText(BlueSystem.getString("soundObjectProperties.name")
                + " " + sObj.getName());
        typeLabel.setText(BlueSystem.getString("common.typeLabel") + " "
                + sObj.getClass().getName());

        String scoreText = "";

        try {
            scoreText = sObj.generateForCSD(CompileData.createEmptyCompileData(), 
                    0.0f, -1.0f).toString();
        } catch (Exception e) {
//            ExceptionDialog
//                    .showExceptionDialog(SwingUtilities.getRoot(this), e);
            Exceptions.printStackTrace(e);
        }

        sObjScoreDisplay.setText(scoreText);
        sObjScoreDisplay.getJEditorPane().setCaretPosition(0);
        sObjScoreDisplay.resetUndoManager();
    }

    public void clear() {
        nameLabel.setText(BlueSystem.getString("soundObjectProperties.name")
                + " ");
        typeLabel.setText(BlueSystem.getString("common.typeLabel") + " ");
        sObjScoreDisplay.setText("");
    }

    public final void testSoundObject() {
        if (this.pObj == null) {
            return;
        }

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();

        if (data == null) {
            System.err.println("PolyObjectEditor::testSoundObject() - "
                    + "Could not get reference to current BlueData object");
            return;
        }

        Tables tables = new Tables(data.getTableSet());
        Arrangement arrangement = new Arrangement(data.getArrangement());
        PolyObject tempPObj = new PolyObject(this.pObj);
        OpcodeList opcodeList = new OpcodeList(data.getOpcodeList());
        GlobalOrcSco globalOrcSco = new GlobalOrcSco(data.getGlobalOrcSco());

        // adding all compile-time instruments from soundObjects to arrangement
        arrangement.generateFTables(tables);
        
        CompileData compileData = new CompileData(arrangement, tables);

        // grabbing all notes from soundObjects
        NoteList generatedNotes = null;

        try {
            generatedNotes = tempPObj.generateForCSD(compileData, 0.0f, -1.0f);
        } catch (Exception e) {
            Exceptions.printStackTrace(e);
            return;
        }

        if (generatedNotes != null) {
            InfoDialog.showInformationDialog(SwingUtilities.getRoot(this),
                    generatedNotes.toString(), BlueSystem
                            .getString("soundObject.generatedScore"));
        }
    }

    /** Table Model used for Sound Object Table */
    static class SoundObjectTableModel extends AbstractTableModel {

        List<SoundObject> sObjects;

        public SoundObjectTableModel() {
        }

        public void setSoundObjects(List<SoundObject> sObjects) {
            if (this.sObjects != null) {
                fireTableRowsDeleted(0, sObjects.size());
            }

            this.sObjects = sObjects;

            if (this.sObjects != null) {
                fireTableRowsInserted(0, sObjects.size());
            }
        }

        @Override
        public String getColumnName(int i) {
            if (i == 0) {
                return BlueSystem.getString("polyObject.soundObject");
            } else if (i == 1) {
                return BlueSystem.getString("polyObject.startTime");
            } else if (i == 2) {
                return BlueSystem.getString("polyObject.duration");
            }
            return null;
        }

        @Override
        public int getColumnCount() {
            return 3;
        }

        @Override
        public Object getValueAt(int parm1, int parm2) {
            if (sObjects == null) {
                return null;
            }
            SoundObject temp = sObjects.get(parm1);
            if (parm2 == 0) {
                return temp.getName();
            } else if (parm2 == 1) {
                return new Float(temp.getStartTime());
            } else if (parm2 == 2) {
                return new Float(temp.getObjectiveDuration());
            } else {
                System.err.println("error in OrchestraTableModel");
                return null;
            }
        }

        @Override
        public int getRowCount() {
            if (sObjects == null) {
                return 0;
            }
            return sObjects.size();
        }
    }

}