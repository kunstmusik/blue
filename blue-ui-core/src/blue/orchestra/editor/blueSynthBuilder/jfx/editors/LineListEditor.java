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

import blue.components.lines.LineList;
import blue.orchestra.blueSynthBuilder.BSBLineObject;
import blue.orchestra.editor.blueSynthBuilder.LineListEditorDialog;
import java.awt.EventQueue;
import java.util.concurrent.CountDownLatch;
import javafx.scene.control.Button;
import javafx.scene.layout.BorderPane;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class LineListEditor extends BorderPane {

    private LineList list;

    public LineListEditor() {
        Button b = new Button("...");
        setRight(b);

        b.setOnAction(e -> {
            LineList newList = new LineList(list);
            CountDownLatch latch = new CountDownLatch(1);
            boolean[] retVal = new boolean[1];
            EventQueue.invokeLater(new Runnable() {
                public void run() {
                    LineListEditorDialog dlg = new LineListEditorDialog();
                    dlg.setModal(true);
                    dlg.setLineList(newList);
                    retVal[0] = dlg.ask();
                    latch.countDown();
                }
            });

            try {
                latch.await();
            } catch (InterruptedException ex) {
                Exceptions.printStackTrace(ex);
            }

            if(retVal[0]){
                list.clear();
                list.addAll(newList);
            }
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

    public void setLineList(LineList list) {
        this.list = list;
    }

    public LineList getLineList(){
        return list;
    }
}
