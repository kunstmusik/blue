/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
import javax.swing.event.DocumentListener;

import blue.components.LabelledPanel;
import blue.gui.BlueEditorPane;
import blue.soundObject.pattern.Pattern;

public class PatternScoreEditor extends JComponent {
    Pattern pattern = null;

    BlueEditorPane score = new BlueEditorPane();

    public PatternScoreEditor() {
        this.setLayout(new BorderLayout());

        score.getDocument().addDocumentListener(new DocumentListener() {

            public void insertUpdate(DocumentEvent e) {
                updatePattern();
            }

            public void removeUpdate(DocumentEvent e) {
                updatePattern();
            }

            public void changedUpdate(DocumentEvent e) {
                updatePattern();
            }

            private void updatePattern() {
                if (score.isEditable() && pattern != null) {
                    pattern.setPatternScore(score.getText());
                }
            }
        });

        LabelledPanel title = new LabelledPanel("Pattern Score", null);

        score.setEditable(false);

        this.add(title, BorderLayout.NORTH);
        this.add(score, BorderLayout.CENTER);
    }

    public void setPattern(Pattern pattern) {
        this.pattern = pattern;

        if (pattern == null) {
            score.setEditable(false);
            score.setText("");
        } else {
            score.setText(pattern.getPatternScore());
            score.setEditable(true);
        }
    }

}
