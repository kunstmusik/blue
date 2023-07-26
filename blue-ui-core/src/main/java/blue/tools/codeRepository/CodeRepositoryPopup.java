/*
 * blue - object composition environment for csound Copyright (c) 2000-2004
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.tools.codeRepository;

import blue.BlueSystem;
import blue.settings.GeneralSettings;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;

class CodeRepositoryPopup extends JPopupMenu {

    CodeRepositoryDialog repository;

    ElementHolder elem;

    CodeRepositoryTreeNode node;

    JMenuItem addGroup = new JMenuItem(BlueSystem
            .getString("codeRepository.addGroup"));

    JMenuItem removeGroup = new JMenuItem(BlueSystem
            .getString("codeRepository.removeGroup"));

    JMenuItem addCode = new JMenuItem(BlueSystem
            .getString("codeRepository.addCodeSnippet"));

    JMenuItem removeCode = new JMenuItem(BlueSystem
            .getString("codeRepository.removeCodeSnippet"));

    public CodeRepositoryPopup() {

        addGroup.addActionListener(ae -> {
            ElementHolder elem = new ElementHolder();
            elem.isGroup = true;
            elem.title = BlueSystem.getString("codeRepository.newGroup");

            CodeRepositoryTreeNode newNode = new CodeRepositoryTreeNode();
            newNode.setUserObject(elem);
            newNode.setAllowsChildren(true);

            repository.treeModel.insertNodeInto(newNode, this.node, this.node
                    .getChildCount());
        });
        this.add(addGroup);

        removeGroup.addActionListener(ae -> {
            repository.treeModel.removeNodeFromParent(this.node);
            repository.cards.show(repository.editPanel, "disabled");
        });
        this.add(removeGroup);

        addCode.addActionListener(ae -> {
            ElementHolder elem = new ElementHolder();
            elem.isGroup = false;
            elem.title = BlueSystem.getString("codeRepository.newCode");

            if (GeneralSettings.getInstance().isNewUserDefaultsEnabled()) {
                elem.text = BlueSystem
                        .getString("codeRepository.insertYourCode");
            } else {
                elem.text = "";
            }

            CodeRepositoryTreeNode newNode = new CodeRepositoryTreeNode();
            newNode.setUserObject(elem);
            newNode.setAllowsChildren(false);

            repository.treeModel.insertNodeInto(newNode, this.node, this.node
                    .getChildCount());
        });
        this.add(addCode);

        removeCode.addActionListener(ae -> {
            repository.treeModel.removeNodeFromParent(this.node);
            repository.cards.show(repository.editPanel, "disabled");
        });
        this.add(removeCode);
    }

    public void show(CodeRepositoryDialog repository,
            CodeRepositoryTreeNode node, ElementHolder elem, int x, int y) {
        this.repository = repository;
        this.elem = elem;
        this.node = node;

        if (elem.isGroup) {
            addGroup.setVisible(true);

            removeGroup.setVisible(!elem.title.equals(BlueSystem.getString("codeRepository.title")));
            addCode.setVisible(true);
            removeCode.setVisible(false);
        } else {
            addGroup.setVisible(false);
            removeGroup.setVisible(false);
            addCode.setVisible(false);
            removeCode.setVisible(true);
        }

        super.show(repository, x, y);
    }
}
