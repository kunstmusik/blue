package blue.soundObject;

import java.util.ArrayList;
import java.util.Collections;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class NoteList extends ArrayList<Note> {

    public NoteList() {
        super();
    }

    public NoteList(NoteList nl) {
        super(nl.size());
        for(Note note :nl) {
            add(new Note(note));
        }
    }

    public final void sort() {
        Collections.sort(this);
    }

    public final void merge(NoteList notes) {
        if (notes == null) {
            return;
        }
        this.addAll(notes);
    }

    @Override
    public final String toString() {
        if (this.size() == 0) {
            return "";
        }

        if (this.size() == 1) {
            return this.get(0).toString() + "\n";
        }

        String[] str = new String[this.size()];
        for (int i = 0; i < this.size(); i++) {
            str[i] = this.get(i).toString();
        }

        return String.join("\n", str);
    }

}