/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.mixer;

import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.mixer.*;
import blue.ui.utilities.SimpleDocumentListener;
import blue.utility.ObjectUtilities;
import com.l2fprod.common.swing.BaseDialog;
import electric.xml.Element;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Container;
import java.awt.Frame;
import javax.swing.GroupLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.LayoutStyle;
import javax.swing.event.DocumentEvent;

public class AddEffectEditorDialog extends BaseDialog implements
        WindowSettingsSavable {

    private Effect effect = null;

    private Effect copy = null;

    JTextField nameText = new JTextField();

    EffectEditor effectEditor = new EffectEditor();

    public AddEffectEditorDialog(Frame parent) {
        super(parent, "Edit Effect", true);
        this.getBanner().setVisible(false);

        this.setDefaultCloseOperation(HIDE_ON_CLOSE);

        Container contentPane = this.getContentPane();
        contentPane.setLayout(new BorderLayout());
        contentPane.add(effectEditor, BorderLayout.CENTER);
        contentPane.add(getNamePanel(), BorderLayout.NORTH);

        nameText.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    @Override
                    public void documentChanged(DocumentEvent e) {
                        if (copy != null) {
                            copy.setName(nameText.getText());
                        } else if (effect != null) {
                            effect.setName(nameText.getText());
                        }
                    }

                });

        this.pack();
        this.centerOnScreen();

        WindowSettingManager.getInstance().registerWindow(
                "AddEffectEditorDialog", this);
    }

    private Component getNamePanel() {
        JPanel panel = new JPanel();

        JLabel label = new JLabel("Name:");

        GroupLayout layout = new GroupLayout(panel);
        panel.setLayout(layout);
        layout.setHorizontalGroup(layout.createParallelGroup(
                GroupLayout.Alignment.LEADING).addGroup(
                layout.createSequentialGroup().addContainerGap().addComponent(label)
                        .addPreferredGap(
                                LayoutStyle.ComponentPlacement.RELATED).addComponent(
                                nameText).addContainerGap()));
        layout.setVerticalGroup(layout.createParallelGroup(GroupLayout.Alignment.LEADING)
                .addGroup(
                        layout.createSequentialGroup().addContainerGap().addGroup(
                                layout
                                        .createParallelGroup(
                                                GroupLayout.Alignment.BASELINE)
                                        .addComponent(label).addComponent(nameText))));

        return panel;
    }

    public void setEffect(Effect effect) {
        if (effect == null) {
            setTitle("Add Effect");

            this.effect = new Effect();
            this.copy = null;

            this.nameText.setText(this.effect.getName());
            effectEditor.setEffect(this.effect);
        } else {
            setTitle("Edit Effect");
            this.effect = effect;
            this.copy = new Effect(effect);

            this.nameText.setText(copy.getName());
            effectEditor.setEffect(copy);
        }

    }

    public void commitEdit() {
        this.effect.setCode(copy.getCode());
        this.effect.setComments(copy.getComments());
        this.effect.setGraphicInterface(copy.getGraphicInterface());
        this.effect.setName(copy.getName());
        this.effect.setNumIns(copy.getNumIns());
        this.effect.setNumOuts(copy.getNumOuts());
    }

    public Effect getEffect() {
        return this.effect;
    }

//    /**
//     * @param args
//     */
//    public static void main(String[] args) {
//        GUI.setBlueLookAndFeel();
//
//        AddEffectEditorDialog dialog = new AddEffectEditorDialog(new JDialog());
//        dialog.setEffect(null);
//        System.out.println(dialog.ask());
//        System.exit(0);
//
//    }

    @Override
    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);
    }

    @Override
    public Element saveWindowSettings() {
        return WindowSettingManager.getBasicSettings(this);
    }
}
