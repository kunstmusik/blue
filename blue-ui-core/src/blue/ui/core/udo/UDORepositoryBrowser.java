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

package blue.ui.core.udo;

import blue.components.LabelledPanel;
import blue.udo.OpcodeList;
import blue.udo.UserDefinedOpcode;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.utility.GUI;
import blue.utility.TextUtilities;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.Elements;
import electric.xml.ParseException;
import java.awt.BorderLayout;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.IOException;
import java.net.MalformedURLException;
import java.util.Vector;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JList;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTree;
import javax.swing.ListSelectionModel;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
import javax.swing.event.TreeSelectionEvent;
import javax.swing.event.TreeSelectionListener;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.TreePath;
import org.apache.xmlrpc.XmlRpcClient;
import org.apache.xmlrpc.XmlRpcException;

/**
 * @author Steven Yi
 */
public class UDORepositoryBrowser extends JDialog {
    private static XmlRpcClient xrpc;

    private static String UDO_REPO_URL = "http://www.csounds.com/udo/xmlrpc.php";

    static {
        try {
            xrpc = new XmlRpcClient(UDO_REPO_URL);
        } catch (MalformedURLException e) {
            xrpc = null;
        }

    }

    JTree categories = new JTree();

    JList udoList = new JList();

    UDODisplayPanel udoDisplayPanel = new UDODisplayPanel();

    OpcodeList opcodeList = null;

    public UDORepositoryBrowser(Window owner) {
        super(owner);

        this.setTitle("User-Defined Opcode Repository Browser");

        categories.setModel(null);
        categories.setRootVisible(false);

        categories.getSelectionModel().addTreeSelectionListener(
                new TreeSelectionListener() {

                    @Override
                    public void valueChanged(TreeSelectionEvent e) {

                        TreePath path = e.getNewLeadSelectionPath();

                        if (path == null) {
                            return;
                        }

                        try {
                            DefaultMutableTreeNode tempNode = (DefaultMutableTreeNode) path
                                    .getLastPathComponent();
                            UDOItem tempCat = (UDOItem) tempNode
                                    .getUserObject();

                            populateUDOList(tempCat);
                        } catch (ClassCastException cce) {
                            // do nothing and ignore (top level root is just a
                            // string)
                        }

                    }

                });

        udoList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        udoList.addListSelectionListener(new ListSelectionListener() {

            @Override
            public void valueChanged(ListSelectionEvent e) {
                if (!e.getValueIsAdjusting()) {
                    Object obj = udoList.getSelectedValue();

                    if (obj == null) {
                        populateUDOList(-1);
                    } else {
                        UDOItem item = (UDOItem) obj;
                        populateUDOList(item.itemId);
                    }

                }
            }

        });

        JScrollPane catScrollPane = new JScrollPane(categories);
        catScrollPane.setBorder(null);

        LabelledPanel categoryPanel = new LabelledPanel("Categories",
                catScrollPane);

        JScrollPane udoScrollPane = new JScrollPane(udoList);
        udoScrollPane.setBorder(null);
        LabelledPanel udoListPanel = new LabelledPanel("User-Defined Opcodes",
                udoScrollPane);

        LabelledPanel udoPanel = new LabelledPanel("User-Defined Opcode",
                udoDisplayPanel);

        JButton importButton = new JButton("Import");
        importButton.addActionListener(new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                addUDOtoOpcodeList();
            }

        });

        udoPanel.add(importButton, BorderLayout.SOUTH);

        JSplitPane innerSplitPane = new JSplitPane(JSplitPane.VERTICAL_SPLIT);
        innerSplitPane.setDividerLocation(200);
        innerSplitPane.add(udoListPanel);
        innerSplitPane.add(udoPanel);

        JSplitPane mainSplitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        mainSplitPane.setDividerLocation(200);
        mainSplitPane.add(categoryPanel);
        mainSplitPane.add(innerSplitPane);

        this.getContentPane().setLayout(new BorderLayout());
        this.getContentPane().add(mainSplitPane);

        setSize(600, 500);
        GUI.centerOnScreen(this);
    }

    /**
     * 
     */
    protected void addUDOtoOpcodeList() {
        UserDefinedOpcode udo = udoDisplayPanel.getUDO();

        if (opcodeList == null || udo == null) {
            return;
        }

        this.opcodeList.addOpcode(udo);

    }

    private UserDefinedOpcode loadOpcodeFromXML(Element udoElement) {
        String opcodeName = udoElement.getElement("name").getTextString();
        String codeText = udoElement.getElement("code").getTextString();

        StringBuffer commentBuffer = new StringBuffer();

        String shortDescription = udoElement.getElement("shortDescription")
                .getTextString();
        String description = udoElement.getElement("description")
                .getTextString();
        String syntax = udoElement.getElement("syntax").getTextString();
        String initialization = udoElement.getElement("initialization")
                .getTextString();
        String performance = udoElement.getElement("performance")
                .getTextString();
        String credits = udoElement.getElement("credits").getTextString();

        commentBuffer.append(opcodeName).append(" - ").append(shortDescription);
        commentBuffer.append("\n\nDESCRIPTION\n").append(description);
        commentBuffer.append("\n\nSYNTAX\n").append(syntax);
        commentBuffer.append("\n\nINITIALIZATION\n").append(initialization);
        commentBuffer.append("\n\nPERFORMANCE\n").append(performance);
        commentBuffer.append("\n\nCREDITS\n").append(credits);

        UserDefinedOpcode udo = new UserDefinedOpcode();

        udo.opcodeName = opcodeName;
        udo.comments = commentBuffer.toString();

        StringBuffer cleanedCode = new StringBuffer();
        int mode = 0;

        String[] lines = codeText.split("\n");

        for (int i = 0; i < lines.length; i++) {
            if (mode == 0) {
                String line = lines[i].trim();
                line = TextUtilities.stripSingleLineComments(line);

                if (line.startsWith("opcode")) {
                    String[] parts = line.substring(6).split(",");

                    if (parts.length == 3) {
                        udo.outTypes = parts[1].trim();
                        udo.inTypes = parts[2].trim();
                    }
                    mode = 1;
                }
            } else if (mode == 1) {
                String line = lines[i];
                if (line.indexOf("endop") >= 0) {
                    break;
                }
                cleanedCode.append(line).append("\n");
            }

        }

        udo.codeBody = cleanedCode.toString();
        return udo;
    }

    /**
     * @param itemId
     */
    protected void populateUDOList(int itemId) {
        // System.out.println("UDO ID: " + itemId);

        if (itemId >= 0) {
            String result = null;
            Vector<Integer> v = new Vector<>();
            v.add(new Integer(itemId));

            try {

                result = (String) xrpc.execute("udo.getUDO", v);
            } catch (    XmlRpcException | IOException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }

            if (result == null) {
                System.err.println("Null Opcode");
                return;
            }

            Document doc = null;

            try {
                doc = new Document(result);
            } catch (ParseException e1) {
                // TODO Auto-generated catch block
                e1.printStackTrace();
            }

            if (doc == null) {
                return;
            }

            // System.out.println(doc.toString());

            Element root = doc.getRoot();

            udoDisplayPanel.setUDO(root);

        }
    }

    /**
     * @param tempCat
     */
    protected void populateUDOList(UDOItem tempCat) {
        // System.out.println("Category ID: " + tempCat.itemId);

        if (tempCat.itemId >= 0) {
            String result = null;
            Vector v = new Vector();
            v.add(new Integer(tempCat.itemId));

            try {

                result = (String) xrpc.execute("udo.getUDOList", v);
            } catch (    XmlRpcException | IOException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }

            if (result == null) {
                System.out.println("Null List");
                return;
            }

            Document doc = null;

            try {
                doc = new Document(result);
            } catch (ParseException e1) {
                // TODO Auto-generated catch block
                e1.printStackTrace();
            }

            if (doc == null) {
                return;
            }

            // System.out.println(doc.toString());

            Element root = doc.getRoot();

            DefaultListModel listItems = new DefaultListModel();

            Elements nodes = root.getElements();

            while (nodes.hasMoreElements()) {
                Element node = nodes.next();

                UDOItem item = new UDOItem();

                item.itemId = Integer.parseInt(node.getAttributeValue("udoId"));
                item.itemName = node.getAttributeValue("name");
                listItems.addElement(item);

            }

            udoList.setModel(listItems);
        }
    }

    public void refreshCategoriesList() {
        String result = null;
        try {
            result = (String) xrpc.execute("udo.getUDOCategoryTree",
                    new Vector());
        } catch (XmlRpcException | IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

        if (result == null) {
            return;
        }

        Document doc = null;

        try {
            doc = new Document(result);
        } catch (ParseException e1) {
            // TODO Auto-generated catch block
            e1.printStackTrace();
        }

        if (doc == null) {
            return;
        }

        Element root = doc.getRoot();

        DefaultMutableTreeNode rootNode = getCategory(root);

        categories.setModel(new DefaultTreeModel(rootNode));

    }

    private DefaultMutableTreeNode getCategory(Element node) {

        UDOItem catObj = new UDOItem();

        if (node.getName().equals("udoCategories")) {
            catObj.itemName = "UDO Categories";
            catObj.itemId = -1;
        } else {
            catObj.itemName = node.getAttributeValue("name");
            catObj.itemId = Integer.parseInt(node
                    .getAttributeValue("categoryId"));
        }

        DefaultMutableTreeNode retVal = new DefaultMutableTreeNode(catObj);

        Elements nodes = node.getElements();

        while (nodes.hasMoreElements()) {
            Element tempNode = nodes.next();

            retVal.add(getCategory(tempNode));
        }

        return retVal;

    }

    public void setOpcodeList(OpcodeList opcodeList) {
        this.opcodeList = opcodeList;
    }

    public static void main(String args[]) {
        GUI.setBlueLookAndFeel();

        UDORepositoryBrowser browser = new UDORepositoryBrowser(null);
        browser.setOpcodeList(new OpcodeList());
        browser.setVisible(true);
        browser.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);
        browser.refreshCategoriesList();
    }

    static class UDOItem {
        public String itemName = "Category";

        public int itemId = -1;

        @Override
        public String toString() {
            return itemName;
        }
    }

    class UDODisplayPanel extends JComponent {
        private MimeTypeEditorComponent codeText;

        private UserDefinedOpcode udo;

        public UDODisplayPanel() {
            codeText = new MimeTypeEditorComponent("text/x-csound-orc");
            codeText.getJEditorPane().setEditable(false);

            this.setLayout(new BorderLayout());

            this.add(codeText);
        }

        public void setUDO(Element node) {
            this.udo = loadOpcodeFromXML(node);

            String codeBody = "/*\n" + udo.comments + "*/\n\n";
            codeBody += udo.codeBody;

            codeText.setText(codeBody);
        }

        public UserDefinedOpcode getUDO() {
            return udo;
        }
    }

}
