/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.orchestra.blueSynthBuilder.BSBTextField;
import blue.ui.utilities.SimpleDocumentListener;
import java.awt.BorderLayout;
import javax.swing.JTextField;
import javax.swing.event.DocumentEvent;

public class BSBTextFieldView extends BSBObjectView<BSBTextField> implements ResizeableView{

    JTextField textField = new JTextField();

    public BSBTextFieldView(final BSBTextField bsbText) {
        super(bsbText);
        
        this.setLayout(new BorderLayout());
        this.add(textField);

        textField.setText(bsbText.getValue());

        textField.getDocument().addDocumentListener(
                new SimpleDocumentListener() {

                    @Override
                    public void documentChanged(DocumentEvent e) {
                        if (bsbText != null) {
                            bsbText.setValue(textField.getText());
                        }

                    }

                });

        this.setSize(bsbText.getTextFieldWidth(), (int) textField
                .getPreferredSize().getHeight());
    }
//
//    public int getTextFieldWidth() {
//        return bsbText.getTextFieldWidth();
//    }

    public void setTextFieldWidth(int width) {
        int w = width;
        if (w < 5) {
            w = 5;
        }

        bsbObj.setTextFieldWidth(w);

        this.setSize(w, this.getHeight());
    }

    public boolean canResizeWidgetWidth() {
        return true;
    }

    public boolean canResizeWidgetHeight() {
        return false;
    }

    public int getWidgetMinimumWidth() {
        return 5;
    }

    public int getWidgetMinimumHeight() {
        return -1;
    }

    public int getWidgetWidth() {
        return bsbObj.getTextFieldWidth();
    }

    public void setWidgetWidth(int width) {
        bsbObj.setTextFieldWidth(Math.max(5, width));
    }

    public int getWidgetHeight() {
        return -1;
    }

    public void setWidgetHeight(int height) {
    }

    public void setWidgetX(int x) {
        bsbObj.setX(x);
    }

    public int getWidgetX() {
        return bsbObj.getX();
    }

    public void setWidgetY(int y) {
        bsbObj.setY(y);
    }

    public int getWidgetY() {
        return bsbObj.getY();
    }
}
