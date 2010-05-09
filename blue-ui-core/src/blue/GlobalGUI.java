package blue;

///*
// * blue - object composition environment for csound
// * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
// *
// * This program is free software; you can redistribute it and/or modify
// * it under the terms of the GNU General Public License as published
// * by  the Free Software Foundation; either version 2 of the License or
// * (at your option) any later version.
// *
// * This program is distributed in the hope that it will be useful, but
// * WITHOUT ANY WARRANTY; without even the implied warranty of
// * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// * GNU General Public License for more details.
// *
// * You should have received a copy of the GNU General Public License
// * along with this program; see the file COPYING.LIB.  If not, write to
// * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
// * Boston, MA  02111-1307 USA
// */
//
//package blue;
//
//import java.awt.BorderLayout;
//
//import javax.swing.BorderFactory;
//import javax.swing.JComponent;
//import javax.swing.JLabel;
//import javax.swing.JPanel;
//import javax.swing.JSplitPane;
//import javax.swing.event.DocumentEvent;
//import javax.swing.event.UndoableEditEvent;
//import javax.swing.event.UndoableEditListener;
//
//import blue.event.SimpleDocumentListener;
//import blue.gui.BlueEditorPane;
//import blue.undo.BlueUndoManager;
//import blue.utility.XMLUtilities;
//import electric.xml.Element;
//import electric.xml.Elements;
//
///**
// * Title: blue Description: an object composition environment for csound
// * Copyright: Copyright (c) 2001 Company: steven yi music
// *
// * @author steven yi
// * @version 1.0
// */
//
//public final class GlobalGUI extends JComponent implements
//        WindowSettingsSavable {
//
//    // BlueData data;
//    GlobalOrcSco globalOrcSco;
//
//    JPanel globalScorePanel = new JPanel();
//
//    JPanel globalOrchestraPanel = new JPanel();
//
//    BlueEditorPane globalOrcText = new BlueEditorPane();
//
//    BlueEditorPane globalNoteText = new BlueEditorPane();
//
//    JSplitPane globalSplitPane = new JSplitPane();
//
//    JLabel globalNoteLabel = new JLabel();
//
//    JLabel globalVariableLabel = new JLabel();
//
//    boolean settingData = false;
//
//    public GlobalGUI() {
//        try {
//            jbInit();
//        } catch (Exception e) {
//            e.printStackTrace();
//        }
//    }
//
//    private void jbInit() throws Exception {
//        globalSplitPane.setBorder(null);
//        this.setLayout(new BorderLayout());
//        globalScorePanel.setLayout(new BorderLayout());
//        globalOrchestraPanel.setLayout(new BorderLayout());
//        globalSplitPane.setOrientation(JSplitPane.VERTICAL_SPLIT);
//        // globalSplitPane.setOneTouchExpandable(true);
//        globalNoteLabel.setText(BlueSystem.getString("global.score"));
//        globalVariableLabel.setText(BlueSystem.getString("global.orchestra"));
//        globalSplitPane.setDividerLocation(200);
//        globalOrchestraPanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5,
//                5));
//        globalScorePanel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
//
//        this.add(globalSplitPane, BorderLayout.CENTER);
//        globalSplitPane.add(globalOrchestraPanel, JSplitPane.LEFT);
//        globalOrchestraPanel.add(globalVariableLabel, BorderLayout.NORTH);
//        globalOrchestraPanel.add(globalOrcText, BorderLayout.CENTER);
//        globalSplitPane.add(globalScorePanel, JSplitPane.RIGHT);
//        globalScorePanel.add(globalNoteText, BorderLayout.CENTER);
//        globalScorePanel.add(globalNoteLabel, BorderLayout.NORTH);
//
//        globalOrcText.getDocument().addDocumentListener(
//                new SimpleDocumentListener() {
//                    public void documentChanged(DocumentEvent e) {
//                        updateGlobalOrc();
//                    }
//                });
//
//        globalNoteText.getDocument().addDocumentListener(
//                new SimpleDocumentListener() {
//                    public void documentChanged(DocumentEvent e) {
//                        updateGlobalScore();
//                    }
//                });
//
//        UndoableEditListener ul = new UndoableEditListener() {
//
//            public void undoableEditHappened(UndoableEditEvent ue) {
//                if (!settingData) {
//                    BlueUndoManager.setUndoManager("global");
//                    BlueUndoManager.addEdit(ue.getEdit());
//                }
//            }
//        };
//
//        globalOrcText.getDocument().addUndoableEditListener(ul);
//        globalNoteText.getDocument().addUndoableEditListener(ul);
//    }
//
//    public void setGlobalOrcSco(GlobalOrcSco globalOrcSco) {
//        settingData = true;
//
//        this.globalOrcSco = globalOrcSco;
//        globalOrcText.setText(globalOrcSco.getGlobalOrc());
//        globalNoteText.setText(globalOrcSco.getGlobalSco());
//
//        settingData = false;
//    }
//
//    private void updateGlobalOrc() {
//        if (globalOrcSco != null && !settingData) {
//            globalOrcSco.setGlobalOrc(globalOrcText.getText());
//        }
//    }
//
//    private void updateGlobalScore() {
//        if (globalOrcSco != null && !settingData) {
//            globalOrcSco.setGlobalSco(globalNoteText.getText());
//        }
//    }
//
//    public void loadWindowSettings(Element settings) {
//        Elements nodes = settings.getElements();
//
//        while (nodes.hasMoreElements()) {
//            Element node = nodes.next();
//            String nodeName = node.getName();
//
//            if (nodeName.equals("GlobalGUI")) {
//
//                Elements instrNodes = node.getElements();
//
//                while (instrNodes.hasMoreElements()) {
//                    Element instrNode = instrNodes.next();
//                    String name = instrNode.getName();
//
//                    if (name.equals("globalSplit")) {
//                        int globalVal = Integer.parseInt(instrNode
//                                .getTextString());
//                        globalSplitPane.setDividerLocation(globalVal);
//                    }
//                }
//            }
//        }
//    }
//
//    public Element saveWindowSettings() {
//        Element retVal = new Element("GlobalGUI");
//
//        int globalVal = globalSplitPane.getDividerLocation();
//
//        retVal.addElement(XMLUtilities.writeInt("globalSplit", globalVal));
//
//        return retVal;
//    }
//}