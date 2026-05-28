package com.kunstmusik.bluejava.jython;

import java.util.ArrayList;
import java.util.Collection;

public final class JythonNoteList extends ArrayList<JythonNote> {
    public JythonNoteList() {
        super();
    }

    public JythonNoteList(Collection<JythonNote> notes) {
        super(notes);
    }

    public void append(JythonNote note) {
        add(note);
    }
}