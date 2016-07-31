/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.ftable;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

import java.util.StringTokenizer;

public class FTable implements Comparable<FTable> {
    int tableNumber, actionTime, tableSize, genRoutine;

    String name, args;

    public FTable() {
        name = "";
    }

    public static FTable createFTable(String FTableText) {
        String temp = FTableText;
        FTable tempTable = new FTable();

        if (temp.indexOf('f') == -1) {
            return null;
        }

        temp = temp.substring(temp.indexOf('f') + 1);

        /* add code to parse a table name after comment */

        int commentStart = FTableText.indexOf(';');

        if (commentStart != -1) {
            temp = FTableText.substring(0, commentStart);
        }

        StringTokenizer st = new StringTokenizer(temp);

        if (st.countTokens() < 4) {
            return null;
        }

        String tempMarker;

        try {
            tempTable.tableNumber = Integer.parseInt(st.nextToken());
            tempTable.actionTime = Integer.parseInt(st.nextToken());
            tempTable.tableSize = Integer.parseInt(st.nextToken());

            tempMarker = st.nextToken();

            tempTable.genRoutine = Integer.parseInt(tempMarker);

        } catch (NumberFormatException nfe) {
            return null;
        }
        tempTable.args = temp.substring(temp.indexOf(tempMarker)
                + tempMarker.length());

        return tempTable;

        // }

    }

    public int getTableNumber() {
        return tableNumber;
    }

    public void setTableNumber(int tableNumber) {
        this.tableNumber = tableNumber;
    }

    public int getActionTime() {
        return actionTime;
    }

    public void setActionTime(int actionTime) {
        this.actionTime = actionTime;
    }

    public int getTableSize() {
        return tableSize;
    }

    public void setTableSize(int tableSize) {
        this.tableSize = tableSize;
    }

    public int getGenRoutine() {
        return genRoutine;
    }

    public void setGenRoutine(int genRoutine) {
        this.genRoutine = genRoutine;
    }

    public String getArgs() {
        return args;
    }

    public void setArgs(String args) {
        this.args = args;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String generateTable() {
        StringBuilder buffer = new StringBuilder();
        buffer.append("f").append(tableNumber).append(" ");
        buffer.append(actionTime).append(" ");
        buffer.append(tableSize).append(" ");
        buffer.append(genRoutine).append(" ");
        buffer.append(args).append(" ");

        return buffer.toString();

    }

    @Override
    public int compareTo(FTable temp) {

        int a = this.getTableNumber();
        int b = temp.getTableNumber();

        if (a > b) {
            return 1;
        } else if (a < b) {
            return -1;
        }
        return 0;
    }

    @Override
    public String toString() {
        String retVal = "[FTable]\n";

        retVal += "Table Number: " + this.tableNumber + "\n";
        retVal += "Action Time: " + this.actionTime + "\n";
        retVal += "Table Size: " + this.tableSize + "\n";
        retVal += "Gen Routine: " + this.genRoutine + "\n";
        retVal += "Arguments: " + this.args + "\n";

        return retVal;
    }

    public static void main(String args[]) {
        String test1 = "f01     0       512     10      1";
        String test2 = "f02     0       128     7       0       10      .003    10      .013         10      .031    10      .079    10      .188    10      .446        5       .690    5       1.068   5       1.639   5       2.512 5       3.894   5       6.029   5       9.263   4       13.119  29      13.119";
        String test3 = "f03 0 1";
        String test4 = "0 1.4 2";
        String test5 = "f01     0.1       512     10      1";
        String test6 = "0 1 2";

        System.out.println(FTable.createFTable(test1));
        System.out.println(FTable.createFTable(test2));
        System.out.println(FTable.createFTable(test3));
        System.out.println(FTable.createFTable(test4));
        System.out.println(FTable.createFTable(test5));
        System.out.println(FTable.createFTable(test6));

    }
}