/*
 * blue - object composition environment for csound
 * Copyright (c) 2021 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder.swing.editors;

import java.beans.PropertyEditorSupport;
import java.math.BigDecimal;

/**
 *
 * @author Steven Yi
 */
public class BigDecimalEditor extends PropertyEditorSupport {

    @Override
    public String getAsText() {
        var v = (BigDecimal) getValue();
        return v.toPlainString();
    }

    @Override
    public void setAsText(String text) throws IllegalArgumentException {
        try {
            setValue(new BigDecimal(text));
        } catch (NumberFormatException nfe) {
            throw new IllegalArgumentException(text + " is not a valid number");
        }
    }

    @Override
    public void setValue(Object value) {
        if (!(value instanceof BigDecimal)) {
            throw new IllegalArgumentException("Value not of type BigInteger");
        }
        super.setValue(value); //To change body of generated methods, choose Tools | Templates.
    }

}
