package blue;

///*
// * blue - object composition environment for csound
// * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
//package blue;
//
//import java.awt.BorderLayout;
//import java.awt.Dimension;
//
//import javax.swing.JComponent;
//import javax.swing.JSplitPane;
//import javax.swing.event.ListSelectionEvent;
//import javax.swing.event.ListSelectionListener;
//
//import blue.event.SelectionEvent;
//import blue.event.SelectionListener;
//import blue.orchestra.Instrument;
//import blue.utility.GUI;
//import blue.utility.XMLUtilities;
//import electric.xml.Element;
//import electric.xml.Elements;
//
///**
// * @author steven
// *
// */
//public class InstrumentsGUI extends JComponent implements WindowSettingsSavable {
//
//    InstrumentEditPanel iEditPanel = new InstrumentEditPanel();
//
//    ArrangementEditPanel arrEditPanel = new ArrangementEditPanel();
//
//    UserInstrumentLibrary userLibrary = new UserInstrumentLibrary();
//
//    JSplitPane topSplitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
//
//    JSplitPane leftSplitPane = new JSplitPane(JSplitPane.VERTICAL_SPLIT);
//
//    boolean isChanging = false;
//
//    public InstrumentsGUI() {
//        this.setLayout(new BorderLayout());
//
//        topSplitPane.setDividerLocation(200);
//
//        leftSplitPane.setDividerLocation(200);
//
//        arrEditPanel.setMinimumSize(new Dimension(0, 0));
//
//        leftSplitPane.add(arrEditPanel);
//        leftSplitPane.add(userLibrary);
//
//        topSplitPane.add(leftSplitPane);
//        topSplitPane.add(iEditPanel);
//
//        this.add(topSplitPane, BorderLayout.CENTER);
//
//        userLibrary.addSelectionListener(new SelectionListener() {
//
//            public void selectionPerformed(SelectionEvent e) {
//                Object obj = e.getSelectedItem();
//
//                if (obj instanceof Instrument) {
//                    isChanging = true;
//
//                    iEditPanel.setEditingLibraryObject(true);
//                    editInstrument((Instrument) obj);
//
//                    arrEditPanel.deselect();
//                    isChanging = false;
//                } else {
//                    isChanging = true;
//
//                    editInstrument(null);
//                    iEditPanel.setEditingLibraryObject(false);
//
//                    arrEditPanel.deselect();
//                    isChanging = false;
//                }
//            }
//
//        });
//
//        arrEditPanel.addListSelectionListener(new ListSelectionListener() {
//
//            public void valueChanged(ListSelectionEvent e) {
//
//                if (e.getValueIsAdjusting() || isChanging) {
//                    return;
//                }
//
//                Instrument instr = arrEditPanel.getSelectedInstrument();
//
//                editInstrument(instr);
//                iEditPanel.setEditingLibraryObject(false);
//                userLibrary.deselect();
//
//            }
//        });
//
//    }
//
//    public void editInstrument(Instrument instrument) {
//        iEditPanel.editInstrument(instrument);
//    }
//
//    public Instrument getInstrumentFromLibrary() {
//        return userLibrary.getSelectedInstrument();
//    }
//
//    public void setInstrumentData(Arrangement arrangement) {
//        iEditPanel.editInstrument(null);
//
//        arrEditPanel.setArrangement(arrangement);
//    }
//
//    // public void removeInstrument(Instrument instr) {
//    // arrEditPanel.instrumentRemoved(instr);
//    // iEditPanel.editInstrument(null);
//    // }
//
//    public static void main(String args[]) {
//        GUI.setBlueLookAndFeel();
//
//        InstrumentsGUI iGUI = new InstrumentsGUI();
//        Arrangement arr = new Arrangement();
//
//        iGUI.setInstrumentData(arr);
//
//        GUI.showComponentAsStandalone(iGUI, "Instruments GUI", true);
//    }
//
//    public void loadWindowSettings(Element settings) {
//        Elements nodes = settings.getElements();
//
//        while (nodes.hasMoreElements()) {
//            Element node = nodes.next();
//            String nodeName = node.getName();
//
//            if (nodeName.equals("InstrumentsGUI")) {
//
//                Elements instrNodes = node.getElements();
//
//                while (instrNodes.hasMoreElements()) {
//                    Element instrNode = instrNodes.next();
//                    String name = instrNode.getName();
//
//                    if (name.equals("topSplit")) {
//                        int topVal = Integer
//                                .parseInt(instrNode.getTextString());
//                        topSplitPane.setDividerLocation(topVal);
//                    } else if (name.equals("arrSplit")) {
//                        int arrVal = Integer
//                                .parseInt(instrNode.getTextString());
//                        leftSplitPane.setDividerLocation(arrVal);
//                    }
//                }
//            }
//        }
//    }
//
//    public Element saveWindowSettings() {
//        Element retVal = new Element("InstrumentsGUI");
//
//        int topVal = topSplitPane.getDividerLocation();
//        int arrVal = leftSplitPane.getDividerLocation();
//
//        retVal.addElement(XMLUtilities.writeInt("topSplit", topVal));
//        retVal.addElement(XMLUtilities.writeInt("arrSplit", arrVal));
//
//        return retVal;
//    }
//
//}
