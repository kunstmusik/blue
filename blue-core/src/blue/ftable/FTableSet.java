package blue.ftable;

/**
 * Title:        blue
 * Description:  an object composition environment for csound
 * Copyright:    Copyright (c) 2001
 * Company:      steven yi music
 * @author steven yi
 * @version 1.0
 */

import java.util.ArrayList;

import blue.utility.ObjectUtilities;

public class FTableSet extends ArrayList {
    public FTableSet() {
        super();
    }

    public int addFTable(FTable ft) {
        int maxTableNum = 0;
        FTable temp;
        for (int i = 0; i < this.size(); i++) {
            temp = (FTable) this.get(i);
            if (temp.getTableNumber() > maxTableNum) {
                maxTableNum = temp.getTableNumber();
            }
        }

        maxTableNum++;

        this.add(ft);
        ft.setTableNumber(maxTableNum);

        return maxTableNum;
    }

    public void removeTable(int tableNumber) {
        FTable temp;
        for (int i = 0; i < this.size(); i++) {
            temp = (FTable) this.get(i);
            if (temp.getTableNumber() == tableNumber) {
                this.remove(i);
                return;
            }
        }
    }

    public String generateTables() {
        StringBuffer buffer = new StringBuffer();
        FTable temp;

        for (int i = 0; i < this.size(); i++) {
            temp = (FTable) this.get(i);
            buffer.append(temp.generateTable() + "\n");
        }

        /*
         * if(instr.isEnabled()) {
         *  }
         */
        return buffer.toString();
    }

    public Object clone() {
        return ObjectUtilities.clone(this);
    }
}