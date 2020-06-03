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

package blue.orchestra;

/**
 * @author Steven Yi
 */
public abstract class AbstractInstrument implements Instrument {

    String name = "untitled";

    String comment = "";

    public AbstractInstrument() {}
    
    public AbstractInstrument(AbstractInstrument absInstr) {
        name = absInstr.name;
        comment = absInstr.comment;
    }

    @Override
    public String getName() {
        return this.name;
    }

    @Override
    public void setName(String name) {
        this.name = (name == null) ? "" : name;
    }

    @Override
    public String getComment() {
        return this.comment;
    }

    @Override
    public void setComment(String comment) {
        this.comment = (comment == null) ? "" : comment;
    }

    @Override
    public String generateAlwaysOnInstrument() {
        return null;
    }
}
