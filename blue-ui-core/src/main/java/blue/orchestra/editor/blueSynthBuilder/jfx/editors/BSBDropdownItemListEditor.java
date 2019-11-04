/*
 * blue - object composition environment for csound
 * Copyright (C) 2016 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.orchestra.editor.blueSynthBuilder.jfx.editors;

import blue.jfx.BlueFX;
import blue.orchestra.blueSynthBuilder.BSBDropdownItemList;
import blue.orchestra.editor.blueSynthBuilder.DropdownItemEditorDialog;
import java.util.concurrent.CountDownLatch;
import javafx.scene.control.Button;
import javafx.scene.layout.BorderPane;
import javax.swing.SwingUtilities;
import org.openide.util.Exceptions;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
public class BSBDropdownItemListEditor extends BorderPane {

    private BSBDropdownItemList list;

    public BSBDropdownItemListEditor() {
        Button b = new Button("...");
        setRight(b);

        b.setOnAction(e -> {
            final BSBDropdownItemList newList = new BSBDropdownItemList(list);
            SwingUtilities.invokeLater(() -> {
                DropdownItemEditorDialog dlg
                        = new DropdownItemEditorDialog(
                                WindowManager.getDefault().getMainWindow());

                dlg.show(newList);
         
                BlueFX.runOnFXThread(() -> {
                    list.setAll(newList);
                });
            });
        });

//            FXMLLoader loader = new FXMLLoader(
//                    getClass().getResource("DropdownItemListEditor.fxml"));
//
//            DropdownItemListEditorController controller; 
//            try { 
//                loader.load();
//                DialogPane dp = loader.getRoot();
//                controller = loader.getController();
//
//                Dialog<ButtonType> d = new Dialog<>();
//                d.setDialogPane(dp);
//                Optional<ButtonType> res = d.showAndWait();
//
//                if(res.isPresent() && res.get() == ButtonType.OK) {
//
//                }
//            } catch (IOException ex) {
//                Exceptions.printStackTrace(ex);
//            }
    }

    public void setBSBDropdownItemList(BSBDropdownItemList list) {
        this.list = list;
    }

    public BSBDropdownItemList getBSBDropdownItemList() {
        return list;
    }
}
