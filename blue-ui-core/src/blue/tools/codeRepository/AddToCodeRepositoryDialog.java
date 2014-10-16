/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

import java.awt.BorderLayout;
import java.awt.Container;

import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextField;
import javax.swing.JTree;
import javax.swing.border.EmptyBorder;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.TreeNode;
import javax.swing.tree.TreePath;

import org.wonderly.awt.Packer;

import blue.tools.codeRepository.CodeRepositoryManager;
import blue.tools.codeRepository.ElementHolder;
import blue.utility.GUI;

import com.l2fprod.common.swing.BaseDialog;

import electric.xml.ParseException;

public class AddToCodeRepositoryDialog extends BaseDialog {

    JTextField nameText = new JTextField();

    JTree categoryTree = new JTree();

    public AddToCodeRepositoryDialog() {
        super((JFrame) null, "Add to Code Repository", true);
        this.getBanner().setVisible(false);

        this.setDefaultCloseOperation(HIDE_ON_CLOSE);

        JPanel panel = new JPanel();
        panel.setBorder(new EmptyBorder(5, 5, 5, 5));
        Packer p = new Packer(panel);

        p.add(new JLabel("Code Snippet Name")).gridx(0).padx(10).pady(10)
                .west();
        p.add(nameText).gridx(1).fillx();
        p.add(new JLabel("Category")).gridx(0).gridy(1).gridw(2);
        p.add(new JScrollPane(categoryTree)).gridx(0).gridy(2).fillboth()
                .gridw(2);

        Container contentPane = this.getContentPane();
        contentPane.setLayout(new BorderLayout());
        contentPane.add(panel, BorderLayout.CENTER);

        this.setSize(400, 300);
        GUI.centerOnScreen(this);
    }

    public void initTree() {
        TreeNode rootNode;
        try {
            rootNode = CodeRepositoryManager.getCodeRepositoryTreeNode(false);
            categoryTree.setModel(new DefaultTreeModel(rootNode));
        } catch (ParseException e) {
            JOptionPane
                    .showMessageDialog(this,
                            "Error: There was an error trying to open or parse codeRepository.xml");
            e.printStackTrace();
        }

    }

    public boolean ask() {
        initTree();
        return super.ask();
    }

    public DefaultMutableTreeNode getUpdatedCodeRepository(String codeSnippet)
            throws ParseException {
        DefaultMutableTreeNode root = (DefaultMutableTreeNode) categoryTree
                .getModel().getRoot();

        TreePath path = categoryTree.getSelectionPath();

        if (path == null || nameText.getText().trim().length() == 0) {
            return null;
        }

        Object[] values = path.getPath();

        DefaultMutableTreeNode codeRoot = (DefaultMutableTreeNode) CodeRepositoryManager
                .getCodeRepositoryTreeNode(true);

        DefaultMutableTreeNode selected = codeRoot;

        if (values.length > 1) {
            for (int i = 1; i < values.length; i++) {
                String key = values[i].toString();

                for (int j = 0; j < selected.getChildCount(); j++) {
                    DefaultMutableTreeNode node = (DefaultMutableTreeNode) selected
                            .getChildAt(j);

                    ElementHolder elem = (ElementHolder) node.getUserObject();

                    // System.out.println(elem.title);

                    if (elem.title.equals(key)) {
                        selected = node;
                    }

                    // if (.equals(object)) {
                    // selected = node;
                    // break;
                    // }
                }

            }
        }

        ElementHolder newElem = new ElementHolder();

        newElem.title = nameText.getText();
        newElem.text = codeSnippet;

        selected.add(new DefaultMutableTreeNode(newElem));

        System.out.println(selected);

        return codeRoot;

        // CodeRepositoryDialog.saveCodeRepository(codeRoot);
    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();
        AddToCodeRepositoryDialog dlg = new AddToCodeRepositoryDialog();
        // dlg.setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        // dlg.show();
        for (int i = 0; i < 3; i++) {
            if (dlg.ask()) {
            }
        }

        System.exit(0);
    }

}
