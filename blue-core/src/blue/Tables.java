package blue;

/**
 * <p>Title: blue</p>
 * <p>Description: an object composition environment for csound</p>
 * <p>Copyright: Copyright (c) 2001-2002</p>
 * <p>Company: steven yi music</p>
 * @author unascribed
 * @version 1.0
 */

import electric.xml.Element;
import java.util.HashMap;
import java.util.HashSet;
import java.util.StringTokenizer;

public class Tables implements java.io.Serializable, Cloneable {
    private String tables = "";

    // used when compiling tables from instruments that are used across
    // instruments
    private transient HashMap compilationVariables = null;

    private transient HashSet ftableNumberSet = null;

    public Tables() {
    }

    public String getTables() {
        return tables;
    }

    public void setTables(String tables) {
        this.tables = tables;
    }

    public Object clone() {
        Tables temp = new Tables();
        temp.setTables(this.getTables());
        return temp;
    }

    /**
     * Gets compilation variable; should only be called by plugins when
     * compiling a CSD is happening. Plugins can check variables that are set,
     * useful for caching ID's, instruments, etc.
     */

    public Object getCompilationVariable(Object key) {
        if (compilationVariables == null) {
            compilationVariables = new HashMap();
            return null;
        }

        return compilationVariables.get(key);
    }

    /**
     * Sets compilation variable; should only be called by plugins when
     * compiling a CSD is happening. Plugins can set variables, useful for
     * caching ID's, instruments, etc.
     */

    public void setCompilationVariable(Object key, Object value) {
        if (compilationVariables == null) {
            compilationVariables = new HashMap();
        }

        compilationVariables.put(key, value);
    }

    public int getOpenFTableNumber() {
        if (ftableNumberSet == null) {
            ftableNumberSet = getFtableNumberSet(this.getTables());
        }

        int counter = 1;
        Integer tableNum = new Integer(counter);
        while (ftableNumberSet.contains(tableNum)) {
            counter++;
            tableNum = new Integer(counter);
        }
        ftableNumberSet.add(tableNum);

        return counter;
    }
    
    public void addFtgenNumber(int ftgenNum) {
        if (ftableNumberSet == null) {
            ftableNumberSet = getFtableNumberSet(this.getTables());
        }
        
        ftableNumberSet.add(new Integer(ftgenNum));
    }

    private static HashSet getFtableNumberSet(String ftableText) {
        HashSet ftableNumbers = new HashSet();
        StringTokenizer st = new StringTokenizer(ftableText, "\n");
        String line;
        String tempLine;
        String temp;
        int index;

        while (st.hasMoreTokens()) {
            line = st.nextToken().trim();
            temp = "";

            if (line.startsWith("f")) {
                index = line.indexOf("f") + 1;
                tempLine = line.substring(index).trim();
                index = 0;
                while (index < tempLine.length()
                        && tempLine.charAt(index) != ' '
                        && tempLine.charAt(index) != '\t') {
                    temp += tempLine.charAt(index);
                    index++;
                }
                try {
                    ftableNumbers.add(new Integer(temp));
                } catch (NumberFormatException nfe) {
                    System.err
                            .println("[error] - Tables::getFtableNumberSet - could not parse FTable number for text: "
                                    + line);
                    System.err.println("Number found was: " + temp);
                }
            }
        }

        return ftableNumbers;
    }

    public static Tables loadFromXML(Element data) {
        Tables tables = new Tables();

        String tableText = data.getTextString();

        tables.setTables(tableText == null ? "" : tableText);

        return tables;
    }

    /**
     * @return
     */
    public Element saveAsXML() {
        Element retVal = new Element("tables");
        retVal.setText(tables);

        return retVal;
    }
}