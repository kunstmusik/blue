/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.orchestra.editor.blueSynthBuilder;

import blue.orchestra.blueSynthBuilder.BSBKnob;
import javax.swing.JEditorPane;
import javax.swing.text.JTextComponent;
import static org.junit.Assert.*;
import org.junit.Test;

/**
 *
 * @author stevenyi
 */
public class BSBCompletionItemTest {
    
    public BSBCompletionItemTest() {
    }

    /**
     * Test of replaceWordBeforeCaret method, of class BSBCompletionItem.
     */
    @Test
    public void testReplaceWordBeforeCaret() {
        
        String replacementText = "<test>";
        JTextComponent jtc = new JEditorPane();
        jtc.setText("<");
        jtc.setCaretPosition(1);
        
        BSBCompletionItem instance = new BSBCompletionItem(new BSBKnob(), "test");
        instance.replaceWordBeforeCaret(replacementText, jtc);
        assertEquals("<test>",jtc.getText());
    }
    
}
