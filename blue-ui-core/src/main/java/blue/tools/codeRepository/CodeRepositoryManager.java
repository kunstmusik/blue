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

package blue.tools.codeRepository;

import blue.BlueSystem;
import blue.ui.core.editor.actions.CodeRepositoryMenu;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.Elements;
import electric.xml.ParseException;
import java.io.File;
import java.io.FileOutputStream;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.TreeNode;

public class CodeRepositoryManager {

    /**
     * @param getCodeNodes
     * @return
     * @throws ParseException
     */
    public static TreeNode getCodeRepositoryTreeNode(boolean getLeafNodes)
            throws ParseException {
        File repository = BlueSystem.getCodeRepository();

        Document doc = new Document(repository);
        Element root = doc.getRoot();
        TreeNode rootNode = getTreeNode(root, getLeafNodes);
        return rootNode;
    }

    private static CodeRepositoryTreeNode getTreeNode(Element node,
            boolean getLeafNodes) {
        CodeRepositoryTreeNode returnNode = new CodeRepositoryTreeNode();
        ElementHolder tempElem = new ElementHolder();
        returnNode.setUserObject(tempElem);
        Elements children;
        switch (node.getName()) {
            case "customAccelerators":
                tempElem.title = BlueSystem.getString("codeRepository.title");
                tempElem.isGroup = true;
                tempElem.isRoot = true;
                returnNode.setAllowsChildren(true);
                children = node.getElements();
                while (children.hasMoreElements()) {
                    returnNode.add(getTreeNode(children.next(), getLeafNodes));
                }
                break;
            case "customGroup":
                tempElem.title = node.getAttribute("name");
                tempElem.isGroup = true;
                returnNode.setAllowsChildren(true);
                if (getLeafNodes) {
                    children = node.getElements();
                    while (children.hasMoreElements()) {
                        returnNode.add(getTreeNode(children.next(), getLeafNodes));
                    }
                }
                break;
            case "customAccelerator":
                returnNode.setAllowsChildren(false);
                tempElem.title = node.getElement("name").getTextString();
                tempElem.text = node.getElement("signature").getTextString();
                break;
        }

        return returnNode;
    }

    public static void saveCodeRepository(DefaultMutableTreeNode node) {

        Element root = getElement(node);

        Document doc = new Document();
        //doc.addChild(new XMLDecl("1.0", "UTF-8"));
        doc.setRoot(root);

        try {
            try (FileOutputStream out = new FileOutputStream(BlueSystem
                         .getCodeRepository())) {
                doc.write(out);
                out.flush();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        CodeRepositoryMenu.reinitialize();

    }

    private static Element getElement(DefaultMutableTreeNode node) {
        ElementHolder elemHolder = (ElementHolder) node.getUserObject();
        Element elem = new Element();

        if (elemHolder.isRoot) {
            elem.setName("customAccelerators");
            for (int i = 0; i < node.getChildCount(); i++) {
                elem.addElement(getElement((DefaultMutableTreeNode) node
                        .getChildAt(i)));
            }
        } else if (elemHolder.isGroup) {
            elem.setName("customGroup");
            elem.setAttribute("name", elemHolder.title);
            for (int i = 0; i < node.getChildCount(); i++) {
                elem.addElement(getElement((DefaultMutableTreeNode) node
                        .getChildAt(i)));
            }
        } else {
            elem.setName("customAccelerator");
            elem.addElement(new Element("name").setText(elemHolder.title));
            elem.addElement(new Element("signature").setText(elemHolder.text));
        }
        return elem;
    }

}
