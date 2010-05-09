package blue.gui;

import java.awt.Component;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;

import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import javax.swing.tree.DefaultMutableTreeNode;

import blue.BlueSystem;
import blue.tools.codeRepository.CodeRepositoryManager;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.Elements;
import electric.xml.ParseException;

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

public class OpcodePopup extends JPopupMenu {

    private AddToCodeRepositoryDialog addDialog = null;

    private BlueEditorPane bEditPane;

    private ActionListener al;

    private ActionListener syntaxListener;

    private static HashMap<String, String> opcodeSignatures = new HashMap<String, String>();

    private Action addToCodeRepository;

    private static OpcodePopup singleton = null;

    private JPopupMenu.Separator syntaxSeparator = new JPopupMenu.Separator();

    private JMenu syntaxMenu;

    private OpcodePopup() {
        al = new ActionListener() {

            public void actionPerformed(ActionEvent ae) {
                int loc = bEditPane.getCaretPosition();

                int start = bEditPane.getSelectionStart();
                int end = bEditPane.getSelectionEnd();

                try {
                    if (end != start) {
                        bEditPane.getDocument().replace(loc, end - loc,
                                ae.getActionCommand(), null);
                    } else {
                        bEditPane.getDocument().insertString(loc,
                                ae.getActionCommand(), null);
                    }
                } catch (javax.swing.text.BadLocationException ble) {
                    ble.printStackTrace();
                }
            }
        };

        syntaxListener = new ActionListener() {
            public void actionPerformed(ActionEvent ae) {
                String syntaxType = ae.getActionCommand();
                bEditPane.setSyntaxType(syntaxType);
                setCurrentSyntax(syntaxType);
                bEditPane.repaint();
            }
        };

        addToCodeRepository = new AddToCodeRepositoryAction();

        syntaxMenu = getSyntaxMenu();

        reinitialize();
    }

    public static OpcodePopup getOpcodePopup() {
        if (singleton == null) {
            singleton = new OpcodePopup();
        }
        return singleton;
    }

    public void show(BlueEditorPane _bEditPane, int x, int y) {
        bEditPane = _bEditPane;

        String selectedText = bEditPane.getSelectedText();
        addToCodeRepository.setEnabled(selectedText != null);

        super.show(_bEditPane, x, y);
    }

    public void reinitialize() {
        System.out.println("[opcodePopup] "
                + BlueSystem.getString("opcodePopup.reinitializeStart"));
        this.removeAll();
        try {
//            File f = new File(blue.BlueSystem.getConfDir() + File.separator
//                    + "opcodes.xml");

            // Builder b = new Builder();
            // nu.xom.Document d = b.build(f);
            //
            // nu.xom.Element root = d.getRootElement();

            electric.xml.Document doc = new electric.xml.Document(
                        CsoundTokenMarker.class.getResourceAsStream("opcodes.xml"));
            Element root = doc.getRoot();

            JMenu opcodeMenu = new JMenu();
            opcodeMenu.setText("Opcodes");

            opcodeSignatures.clear();
            populatePopup(root, opcodeMenu);

            doc = new Document(BlueSystem.getCodeRepository());
            Element root2 = doc.getRoot();
            JMenu customMenu = new JMenu();
            customMenu.setText("Custom");
            populateCustom(root2, customMenu);

            this.add(getBlueMenu());
            this.add(opcodeMenu);
            this.add(customMenu);
            this.addSeparator();
            this.add(addToCodeRepository);
            this.add(syntaxSeparator);
            this.add(syntaxMenu);
        } catch (ParseException pe) {
            System.out.println("[blue.gui.OpcodePopup] "
                    + BlueSystem.getString("message.file.couldNotOpenOrParse")
                    + " opcodes.xml or codeRepository.xml");
            pe.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        }

        System.out.println("[opcodePopup] "
                + BlueSystem.getString("opcodePopup.reinitializeFinished"));
    }

    private JMenu getSyntaxMenu() {
        JMenu menu = new JMenu("Syntax Type");

        Object[] syntaxTypes = BlueEditorPane.getSyntaxTypes();

        for (int i = 0; i < syntaxTypes.length; i++) {
            String syntaxType = (String) syntaxTypes[i];

            menu.add(syntaxType).addActionListener(syntaxListener);
        }

        return menu;
    }

    /**
     * Generates a menu with Blue variables
     * 
     * @return
     */
    private JMenu getBlueMenu() {
        JMenu blueMenu = new JMenu(BlueSystem
                .getString("opcodePopup.blueVariables"));

        String[] values = { "<TOTAL_DUR>", "<RENDER_START>",
                "<PROCESSING_START>", "<INSTR_ID>", "<INSTR_NAME>" };

        for (int i = 0; i < values.length; i++) {
            JMenuItem item = new JMenuItem();
            item.setText(values[i]);
            item.setActionCommand(values[i]);
            item.addActionListener(al);

            blueMenu.add(item);
        }

        return blueMenu;
    }

    private void populatePopup(Element root, JMenu menu) {

        Elements temp = root.getElements("opcodeGroup");
        Elements temp2 = root.getElements("opcode");
        Element tempElement;

        while (temp.hasMoreElements()) {
            tempElement = temp.next();
            JMenu tempMenu = new JMenu();
            tempMenu.setText(tempElement.getAttributeValue("name"));
            menu.add(tempMenu);
            populatePopup(tempElement, tempMenu);
        }
        int counter = 0;
        while (temp2.hasMoreElements()) {
            tempElement = temp2.next();
            JMenuItem tempMenuItem = new JMenuItem();

            String opcodeName = tempElement.getElement("name").getTextString();
            String opcodeSignature = tempElement.getElement("signature")
                    .getTextString();

            tempMenuItem.setText(opcodeName);
            tempMenuItem.setActionCommand(opcodeSignature);

            tempMenuItem.addActionListener(al);

            opcodeSignatures.put(opcodeName, opcodeSignature);

            if (counter < 10) {
                menu.add(tempMenuItem);
                counter++;
            } else {
                JMenu tempMenu = new JMenu(BlueSystem.getString("menu.more"));
                menu.add(tempMenu);
                menu = tempMenu;
                menu.add(tempMenuItem);
                counter = 1;
            }
        }
    }

    // private void populatePopup2(nu.xom.Element root, JMenu menu) {
    //
    // nu.xom.Elements temp = root.getChildElements("opcodeGroup");
    // nu.xom.Elements temp2 = root.getChildElements("opcode");
    // nu.xom.Element tempElement;
    //
    // for (int i = 0; i < temp.size(); i++) {
    // tempElement = temp.get(i);
    // JMenu tempMenu = new JMenu();
    // tempMenu.setText(tempElement.getAttributeValue("name"));
    // menu.add(tempMenu);
    // populatePopup2(tempElement, tempMenu);
    // }
    // int counter = 0;
    // for (int i = 0; i < temp2.size(); i++) {
    // tempElement = temp2.get(i);
    // JMenuItem tempMenuItem = new JMenuItem();
    //
    // nu.xom.Elements nodes = tempElement.getChildElements();
    //
    // String opcodeName = nodes.get(0).getValue();
    // String opcodeSignature = nodes.get(1).getValue();
    //
    // tempMenuItem.setText(opcodeName);
    // tempMenuItem.setActionCommand(opcodeSignature);
    //
    // tempMenuItem.addActionListener(al);
    //
    // opcodeSignatures.put(opcodeName, opcodeSignature);
    //
    // if (counter < 10) {
    // menu.add(tempMenuItem);
    // counter++;
    // } else {
    // JMenu tempMenu = new JMenu(BlueSystem.getString("menu.more"));
    // menu.add(tempMenu);
    // menu = tempMenu;
    // menu.add(tempMenuItem);
    // counter = 1;
    // }
    // }
    // }

    private void populateCustom(Element root, JMenu menu) {
        Elements temp = root.getElements("customGroup");
        Elements temp2 = root.getElements("customAccelerator");
        while (temp.hasMoreElements()) {
            Element tempElement = temp.next();
            JMenu tempMenu = new JMenu();
            tempMenu.setText(tempElement.getAttributeValue("name"));
            menu.add(tempMenu);
            populateCustom(tempElement, tempMenu);
        }
        int counter = 0;
        while (temp2.hasMoreElements()) {
            Element tempElement = temp2.next();
            JMenuItem tempMenuItem = new JMenuItem();
            tempMenuItem
                    .setText(tempElement.getElement("name").getTextString());
            tempMenuItem.setActionCommand(tempElement.getElement("signature")
                    .getTextString());
            tempMenuItem.addActionListener(al);
            if (counter < 10) {
                menu.add(tempMenuItem);
                counter++;
            } else {
                JMenu tempMenu = new JMenu(BlueSystem.getString("menu.more"));
                menu.add(tempMenu);
                menu = tempMenu;
                menu.add(tempMenuItem);
                counter = 1;
            }
        }
    }

    public String[] getOpcodeMatches(String possibleOpcode) {
        ArrayList<String> opcodeMatches = new ArrayList<String>();

        for (Iterator iter = opcodeSignatures.keySet().iterator(); iter
                .hasNext();) {
            String key = (String) iter.next();

            if (key.startsWith(possibleOpcode)) {
                // opcodeMatches.add(opcodeSignatures.get(key));
                opcodeMatches.add(key);
            }
        }

        Collections.sort(opcodeMatches);

        String[] matches = new String[opcodeMatches.size()];

        for (int i = 0; i < matches.length; i++) {
            matches[i] = opcodeMatches.get(i);
        }

        return matches;

    }

    public static String getOpcodeSignature(String opcodeKey) {
        return (String) opcodeSignatures.get(opcodeKey);
    }

    class AddToCodeRepositoryAction extends AbstractAction {

        public AddToCodeRepositoryAction() {
            super("Add to Code Repository");

            putValue(Action.SHORT_DESCRIPTION,
                    "Add Selected Text to Code Repository");
        }

        public void actionPerformed(ActionEvent e) {
            addToCodeRepository();
        }

        public void addToCodeRepository() {
            if (bEditPane == null || !bEditPane.isEditable()) {
                return;
            }

            String selectedText = bEditPane.getSelectedText();

            if (selectedText.length() == 0) {
                return;
            }

            if (addDialog == null) {
                addDialog = new AddToCodeRepositoryDialog();
            }

            while (addDialog.ask()) {
                DefaultMutableTreeNode rootNode;

                try {
                    rootNode = addDialog.getUpdatedCodeRepository(selectedText);
                } catch (ParseException e) {
                    e.printStackTrace();
                    JOptionPane
                            .showMessageDialog(null,
                                    "There was an error trying to open or parse opcodes.xml or codeRepository.xml");
                    return;
                }

                if (rootNode == null) {
                    JOptionPane.showMessageDialog(null,
                            "Error: Code Snippet Name not filled in or "
                                    + "Category not selected.");
                } else {
                    CodeRepositoryManager.saveCodeRepository(rootNode);
                    reinitialize();
                    return;
                }

            }
        }

    }

    public void setCurrentSyntax(String syntaxType) {
        Component[] items = syntaxMenu.getMenuComponents();

        for (int i = 0; i < items.length; i++) {
            JMenuItem item = (JMenuItem) items[i];
            boolean match = item.getText().equals(syntaxType);
            item.setEnabled(!match);
        }
    }

    public void setSyntaxSettable(boolean syntaxSettable) {
        syntaxSeparator.setVisible(syntaxSettable);
        syntaxMenu.setVisible(syntaxSettable);
    }

    // public static void main(String args[]) {
    // File f = new File(blue.BlueSystem.getConfDir()
    // + File.separator + "opcodes.xml");
    //
    // Builder b = new Builder();
    // nu.xom.Document d;
    // try {
    // d = b.build(f);
    // } catch (ValidityException e) {
    // // TODO Auto-generated catch block
    // e.printStackTrace();
    // } catch (ParsingException e) {
    // // TODO Auto-generated catch block
    // e.printStackTrace();
    // } catch (IOException e) {
    // // TODO Auto-generated catch block
    // e.printStackTrace();
    // }
    //
    // }
}