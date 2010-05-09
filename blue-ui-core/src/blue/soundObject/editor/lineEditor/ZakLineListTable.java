/*
 * ZakLineTable.java
 *
 * Created on July 19, 2005, 8:29 AM
 */

package blue.soundObject.editor.lineEditor;

import blue.components.lines.LineListTable;
import blue.components.lines.LineListTableModel;

/**
 * Sparse implementation of LineTable, only difference being the LineTableModel
 * used.
 * 
 * @author mbechard
 */
public class ZakLineListTable extends LineListTable {

    /** Creates a new instance of ZakLineTable */
    public ZakLineListTable() {
        super();
    }

    protected LineListTableModel getNewLineTableModel() {
        return new ZakLineListTableModel();
    }
}
