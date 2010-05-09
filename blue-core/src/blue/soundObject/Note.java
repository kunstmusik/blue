/*
 * blue - object composition environment for csound Copyright (c) 2001-2003
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.soundObject;

import java.io.Serializable;
import java.util.ArrayList;

import org.apache.commons.lang.text.StrBuilder;

import blue.BlueSystem;
import blue.utility.NumberUtilities;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreExpressionParser;

/**
 * Title: blue (Object Composition Environment) Description: Copyright:
 * Copyright (c) steven yi Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class Note implements Serializable, Comparable {

    private String[] fields;

    private float subjectiveDuration;

    boolean isTied = false;

    private Note() {
        /*
         * try { noteInit(input); } catch(Exception e) { e.printStackTrace(); }
         */
    }

    public static Note createNote(int numFields) {
        Note n = new Note();

        n.fields = new String[numFields];

        for (int i = 0; i < numFields; i++) {
            n.setPField(Integer.toString(i), i + 1);
        }

        return n;
    }

    public static Note createNote(String input) throws NoteParseException {
        return createNote(input, null);
    }

    public static Note createNote(String input, Note previousNote)
            throws NoteParseException {
        if (!input.startsWith("i")) {
            String errorMessage = BlueSystem.getString("note.invalidNoteText")
                    + " " + input;

            throw new NoteParseException(errorMessage, input);
        }

        try {
            Note n = new Note();
            final String cleanNoteString = input
                    .substring(input.indexOf("i") + 1);
            n.noteInit(cleanNoteString, previousNote);
            return n;
        } catch (Exception e) {
            String errorMessage = BlueSystem.getString("note.invalidNoteText")
                    + " " + input;
            throw new NoteParseException(errorMessage, input);
        }
    }

    private void noteInit(String input, Note previousNote) throws Exception {
        // If for any reason there should be an exception
        // let it bubble up and the note factory method will
        // return null

        int i = 0;
        ArrayList buffer = new ArrayList();
        int size = input.length();

        int start = 0;

        // the following code might be better off using
        // regular expressions, but should wait until
        // Java 1.4 is available on all platforms

        // PARSES PFIELDS FROM STRING
        while (i < size) {
            if (input.charAt(i) == '\"') {
                start = i++;

                while (i < size && input.charAt(i) != '\"') {
                    i++;
                }

                buffer.add(input.substring(start, ++i));
                // i++;
            } else if (input.charAt(i) == '[') {
                start = ++i;
                while (i < size && input.charAt(i) != ']') {
                    i++;
                }

                float val = ScoreExpressionParser.eval(input
                        .substring(start, i));

                i++;

                buffer.add(Float.toString(val));
            } else if (input.charAt(i) == ' ' || input.charAt(i) == '\t') {
                while (i < size
                        && (input.charAt(i) == ' ' || input.charAt(i) == '\t')) {
                    i++; // eat up empty spaces or tabs
                }
            } else {
                start = i;
                while (i < size
                        && (input.charAt(i) != ' ' && input.charAt(i) != '\t')) {
                    i++;
                }
                buffer.add(input.substring(start, i));
            }
        }

        

        if(previousNote != null) {
            boolean performCarry = buffer.get(0).equals(previousNote.getPField(1));

            if(!performCarry) {
                try {
                    int instr1 = (int) (Float.parseFloat((String)buffer.get(0)));
                    int instr2 = (int) (Float.parseFloat(previousNote.getPField(1)));

                    if(instr1 == instr2) {
                        performCarry = true;
                    }
                } catch (NumberFormatException nfe) {
                    performCarry = false;
                }
            }


            if(performCarry) {
                int numFieldsToCopy = previousNote.getPCount() - buffer.size();
                if(numFieldsToCopy > 0) {
                    for(i = previousNote.getPCount() - numFieldsToCopy; i < previousNote.getPCount(); i++) {
                        buffer.add(previousNote.getPField(i + 1));
                    }
                }
            }
        }
        
        // INITIALIZES PFIELD ARRAY
        fields = (String[]) buffer.toArray(new String[buffer.size()]);

        if(previousNote != null) {


            // SWAP PERIODS WITH VALUE FROM PREVIOUS NOTE
            for (i = 0; i < fields.length; i++) {
                if (fields[i].equals(".")) {
                    fields[i] = previousNote.getPField(i + 1);
                }
            }
        }

        float dur = Float.parseFloat(fields[2]);

        setSubjectiveDuration(dur);
        setTied(dur < 0.0f);
    }

    public String toString() {
        StrBuilder temp = new StrBuilder();

        int strSize = 1;

        for (int i = 0; i < fields.length; i++) {
            strSize += fields[i].length() + 1;
        }

        temp.ensureCapacity(strSize);

        temp.append("i");

        int size = fields.length;
        for (int i = 0; i < size; i++) {
            if (i == 2) {
                if (this.isTied) {
                    temp.append("-");
                }
                temp.append(NumberUtilities.formatFloat(subjectiveDuration))
                        .append("\t");
            } else {
                temp.append(fields[i]);

                if (i < size - 1) {
                    temp.append("\t");
                }
            }
        }

        return temp.toString();
    }

    public void setStartTime(float yo) {
        fields[1] = Float.toString(yo);
    }

    public float getStartTime() {
        return Float.parseFloat(fields[1]);
    }

    public void setSubjectiveDuration(float dur) {
        subjectiveDuration = Math.abs(dur);
    }

    public float getSubjectiveDuration() {
        return subjectiveDuration;
    }

    public float getObjectiveDuration() {
        return getSubjectiveDuration();
    }

    public int getPCount() {
        return fields.length;
    }

    public String getPField(int i) {
        return fields[i - 1];
    }

    public void setPField(String arg, int index) {
        if (index == 3) {
            setSubjectiveDuration(Float.parseFloat(arg));
        }
        fields[index - 1] = arg;
    }

    public Object clone() {
        return ObjectUtilities.clone(this);
    }

    public int compareTo(Object pObj) {
        Note a = (Note) pObj;

        float t1 = this.getStartTime();
        float t2 = a.getStartTime();

        if (t1 > t2) {
            return 1;
        } else if (t1 < t2) {
            return -1;
        }

        return 0;
    }

    public static void main(String[] args) {
        Note testNote;
        try {
            testNote = Note.createNote("i1 2 3 4 5");
            testNote.setSubjectiveDuration(12f);
            System.out.println(testNote.toString());

            testNote = Note.createNote("i1 [4 + 23] 5 4");
            testNote.setSubjectiveDuration(12f);
            System.out.println(testNote.toString());

            testNote = Note.createNote("i1 [4 + 23 -] 5 4");
            testNote.setSubjectiveDuration(12f);
            System.out.println(testNote.toString());

        } catch (NoteParseException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
    }

    /**
     * @return Returns the isTied.
     */
    public boolean isTied() {
        return isTied;
    }

    /**
     * @param isTied
     *            The isTied to set.
     */
    public void setTied(boolean isTied) {
        this.isTied = isTied;
    }

    /**
     * @return
     */
    public float getEndTime() {
        return getStartTime() + getSubjectiveDuration();
    }
}