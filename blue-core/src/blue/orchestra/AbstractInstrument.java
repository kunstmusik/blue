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

package blue.orchestra;

import blue.utility.ObjectUtilities;
import java.io.Serializable;

/**
 * @author Steven Yi
 */
public abstract class AbstractInstrument implements Instrument, Serializable {

    String name = "untitled";

    String comment = "";

    // String testScore = "";

    boolean enabled = true;

    int instrumentNumber = 0;

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = (name == null) ? "" : name;
    }

    public String getComment() {
        return this.comment;
    }

    public void setComment(String comment) {
        this.comment = (comment == null) ? "" : comment;
    }

    // public String getTestScore() {
    // return this.testScore;
    // }
    //
    // public void setTestScore(String testScore) {
    // this.testScore = testScore;
    // }

    public int getInstrumentNumber() {
        return this.instrumentNumber;
    }

    public void setInstrumentNumber(int instrumentNumber) {
        this.instrumentNumber = instrumentNumber;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public Object clone() {
        return ObjectUtilities.clone(this);
    }

    public String generateAlwaysOnInstrument() {
        return null;
    }
}
