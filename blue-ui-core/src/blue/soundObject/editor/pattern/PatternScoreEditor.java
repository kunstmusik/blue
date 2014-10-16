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
package blue.soundObject.editor.pattern;

import java.awt.BorderLayout;

import javax.swing.JComponent;
import javax.swing.event.DocumentEvent;

import blue.components.LabelledPanel;
import blue.soundObject.pattern.Pattern;
import blue.ui.nbutilities.MimeTypeEditorComponent;
import blue.ui.utilities.SimpleDocumentListener;
import javax.swing.undo.UndoManager;
import org.openide.awt.UndoRedo;

public class PatternScoreEditor extends JComponent {
    Pattern pattern = null;

    MimeTypeEditorComponent score1 = new MimeTypeEditorComponent("text/x-csound-sco");
    
    UndoManager undo = new UndoRedo.Manager();

    public PatternScoreEditor() {
        this.setLayout(new BorderLayout());

        score1.getDocument().addDocumentListener(new SimpleDocumentListener() {

            @Override
            public void documentChanged(DocumentEvent e) {
                if (score1.getJEditorPane().isEditable() && pattern != null) {
                    pattern.setPatternScore(score1.getText());
                }
            }
        });

        LabelledPanel title = new LabelledPanel("Pattern Score", null);

        score1.getJEditorPane().setEditable(false);

        this.add(title, BorderLayout.NORTH);
        this.add(score1, BorderLayout.CENTER);
        
        score1.setUndoManager(undo);
        score1.getDocument().addUndoableEditListener(undo);
    }

    public void setPattern(Pattern pattern) {
        this.pattern = pattern;

        if (pattern == null) {
            score1.getJEditorPane().setEditable(false);
            score1.setText("");
        } else {
            score1.setText(pattern.getPatternScore());
            score1.getJEditorPane().setEditable(true);
        }
        
        undo.discardAllEdits();
    }

}
