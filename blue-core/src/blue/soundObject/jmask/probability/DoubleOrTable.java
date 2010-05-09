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
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject.jmask.probability;

import java.io.Serializable;

import blue.soundObject.jmask.Table;

public class DoubleOrTable implements Serializable {
    double value = 0.0;

    Table table;

    boolean tableEnabled = false;

    private DoubleOrTable() {

    }

    public double getValue(double time) {
        if (tableEnabled) {
            return table.getValue(time);
        }
        return value;
    }

    public DoubleOrTable(double defaultVal) {
        this.value = defaultVal;
        table = new Table();
    }

    public Table getTable() {
        return table;
    }

    public void setTable(Table table) {
        this.table = table;
    }

    public boolean isTableEnabled() {
        return tableEnabled;
    }

    public void setTableEnabled(boolean tableEnabled) {
        this.tableEnabled = tableEnabled;
    }

    public double getValue() {
        return value;
    }

    public void setValue(double value) {
        this.value = value;
    }

}
